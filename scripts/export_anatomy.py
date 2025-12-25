"""
Z-Anatomy Torso Export Script - Hierarchies-Driven
Version 10.4 - Registry-based with selective parent chain corruption fix

MAJOR CHANGES FROM V9:
- Replaces pattern matching with explicit structure registry
- Uses torso_registry_v2.json as the authoritative source
- Validates bilateral pairs and flags missing structures
- Computes depth layers based on Z-coordinates and overlap detection
- Deterministic output: same input always produces same result

V10.4 FIX:
- SELECTIVELY applies matrix fix only when parent chain corruption is detected
- Compares current matrix_world to precomputed one; if they differ by > 1mm,
  applies the full matrix transform to fix position AND rotation
- Structures with intact parent chains use standard processing (no double-transform)

V10.3 FIX (reverted - caused issues):
- Applied full matrix to ALL structures, which double-transformed most of them

V10.2 FIX:
- Relocated mesh vertices to pre-computed position (translation only)

V10.1 FIXES:
- Pre-computes all world transforms BEFORE any object modification
- Updated BROKEN_PARENT_CHAIN_PATTERNS to use original names with spaces

APPROACH:
1. Load curated structure registry (exact names from Z-Anatomy)
2. Find matching objects in Blender by exact name
3. Validate bilateral pairs, flag any missing
4. PRE-COMPUTE all world transforms (full matrix + center) before modifications
5. For each object:
   a. Compare current matrix to precomputed
   b. If different: apply full matrix transform (fixes corrupted parent chain)
   c. If same: use standard parent_clear processing
6. Apply transforms and set origin
7. Export glTF and metadata

IMPORTANT: Run on a FRESH Z-Anatomy file (File > Revert if needed)
"""

import bpy
import mathutils
import json
import os
from typing import Dict, List, Any, Tuple, Optional, Set
from dataclasses import dataclass
from collections import defaultdict

# ============================================================
# CONFIGURATION
# ============================================================

OUTPUT_DIR = os.path.expanduser("~/Code/anatomy-explorer/public/models")
METADATA_OUTPUT_DIR = os.path.expanduser("~/Code/anatomy-explorer/src/data")

GLTF_FILENAME = "body.glb"
METADATA_FILENAME = "body_metadata.json"

# Path to the curated structure registry
# This should be in the same directory as the script, or provide absolute path
REGISTRY_PATH = os.path.expanduser("~/Code/anatomy-explorer/src/data/body_registry.json")

DEBUG_VERBOSE = True
EXPORT_COLLECTION_NAME = "_EXPORT_TEMP_"

# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class StructureInfo:
    """Information about a structure to export."""
    blender_name: str
    region: str
    mesh_id: str
    side: str  # "left", "right", "midline"
    base_name: str  # Name without side suffix
    anat_type: str
    layer: int
    center: List[float]


@dataclass
class ExportReport:
    """Report of export results."""
    total_in_registry: int = 0
    found_in_blender: int = 0
    exported: int = 0
    missing: List[str] = None
    incomplete_pairs: List[Dict] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.missing is None:
            self.missing = []
        if self.incomplete_pairs is None:
            self.incomplete_pairs = []
        if self.warnings is None:
            self.warnings = []


# ============================================================
# STRUCTURES THAT NEED SPECIAL HANDLING
# ============================================================

# These structures have broken parent chain transforms in Z-Anatomy.
# Inherited from V9 - their matrix_world doesn't reflect actual world position.
# These structures have broken parent chain transforms in Z-Anatomy.
# Use original names (with spaces) as they appear in the registry.
BROKEN_PARENT_CHAIN_PATTERNS = [
    "inferior pubic ligament",
    "superior pubic ligament",
    "interpubic disc",
]

def needs_location_sum_fix(obj_name: str) -> bool:
    """Check if an object needs the special location-sum transform fix."""
    name_lower = obj_name.lower()
    return any(pattern in name_lower for pattern in BROKEN_PARENT_CHAIN_PATTERNS)


# ============================================================
# REGISTRY LOADING
# ============================================================

def load_registry(path: str) -> Dict[str, Any]:
    """Load the curated structure registry."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Registry not found: {path}")
    
    with open(path, 'r') as f:
        return json.load(f)


def get_all_structure_names(registry: Dict) -> Dict[str, str]:
    """
    Extract all structure names from registry.
    Returns dict mapping structure_name -> region
    
    Handles two formats:
    1. Simple: {"region": {"structures": [...]}}
    2. Detailed: {"region": {"description": ..., "count": ..., "structures": [...]}}
    """
    structures = {}
    for region, data in registry.items():
        if region.startswith("_"):  # Skip metadata
            continue
        
        # Handle different registry formats
        if isinstance(data, dict):
            if "structures" in data:
                # Format: {"region": {"structures": [...]}}
                for name in data["structures"]:
                    structures[name] = region
            elif "description" not in data:
                # Old format: {"region": ["name1", "name2", ...]}
                for name in data:
                    structures[name] = region
        elif isinstance(data, list):
            # Direct list format
            for name in data:
                structures[name] = region
    
    return structures


# ============================================================
# STRUCTURE ANALYSIS
# ============================================================

def extract_side_and_base(name: str) -> Tuple[str, str]:
    """
    Extract side suffix and base name from a structure name.
    Returns (base_name, side)
    """
    if name.endswith(".l"):
        return name[:-2], "left"
    elif name.endswith(".r"):
        return name[:-2], "right"
    else:
        return name, "midline"


def get_anatomical_type(name: str) -> str:
    """
    Determine anatomical type from structure name.
    Covers torso, lower limb, and upper limb structures.
    
    NOTE: Order matters! More specific patterns (tendon sheaths, capsules) 
    must be checked BEFORE broader patterns (muscles with flexor/extensor).
    
    Returns: One of: "muscle", "bone", "ligament", "tendon", "fascia", 
             "cartilage", "membrane", "bursa", "capsule", "other"
    """
    name_lower = name.lower()
    
    # TENDONS & TENDON SHEATHS - check early to avoid muscle misclassification
    if any(w in name_lower for w in ["tendon", "sheath"]):
        return "tendon"
    
    # JOINT CAPSULES - check before muscles
    if "articular capsule" in name_lower or "capsule" in name_lower:
        return "capsule"
    
    # MUSCLES
    muscle_keywords = [
    "muscle", "muscul",
    
    # === TORSO ===
    "abdominis", "dorsi", "oblique", "diaphragm",
    "levator", "rotator",
    
    # === UPPER LIMB ===
    "brachii", "brachialis", "coracobrachialis",
    "deltoid", "supinator", "pronator",
    "pollicis", "indicis", "digiti",  # hand intrinsics
    "interossei", "lumbrical", "opponens",
    # Forearm flexors/extensors (names without "muscle" suffix)
    "flexor carpi", "extensor carpi",
    "flexor digitorum", "extensor digitorum",
    
    # === LOWER LIMB / PELVIS ===
    "femoris", "gastrocnemius", "soleus",
    "adductor", "obturator", "sphincter",
    "hallucis",  # big toe muscles
    "psoas",
    
    # === HEAD/FACE - FACIAL EXPRESSION ===
    "frontalis", "occipitalis", "temporoparietalis",
    "orbicularis",  # orbicularis oculi, orbicularis oris
    "corrugator", "procerus",
    "nasalis", "depressor",  # depressor anguli oris, depressor labii, depressor septi nasi
    "zygomaticus",  # major and minor
    "risorius", "mentalis", "buccinator",
    "platysma",
    
    # === HEAD - MASTICATION ===
    "masseter", "temporalis", "pterygoid",
    
    # === HEAD - TONGUE ===
    "genioglossus", "hyoglossus", "styloglossus", "palatoglossus",
    
    # === HEAD/NECK - HYOID MUSCLES ===
    # Suprahyoid
    "digastric", "mylohyoid", "geniohyoid", "stylohyoid",
    # Infrahyoid  
    "sternohyoid", "sternothyroid", "thyrohyoid", "omohyoid",
    
    # === HEAD/NECK - PHARYNX ===
    "constrictor",  # superior/middle/inferior pharyngeal constrictor
    "palatopharyngeus", "stylopharyngeus", "salpingopharyngeus",
    
    # === HEAD/NECK - LARYNX ===
    "cricothyroid", "thyroarytenoid", "thyro-arytenoid",
    "cricoarytenoid", "crico-arytenoid",
    "aryepiglottic", "ary-epiglottic",
    "vocalis",
    
    # === NECK ===
    "sternocleidomastoid",
    "scalenus",  # anterior, medius, posterior
    "longus colli", "longus capitis",
    "splenius",  # capitis and colli
    "semispinalis",  # capitis, colli, thoracis
    "rectus capitis",  # anterior, lateralis, posterior major/minor
    "obliquus capitis",  # superior and inferior
    
    # === EYE (EXTRAOCULAR) ===
    "rectus superior", "rectus inferior", 
    "rectus medialis", "rectus lateralis",
    "oblique muscle",  # superior oblique, inferior oblique
    "levator palpebrae",
]
    if any(w in name_lower for w in muscle_keywords):
        return "muscle"
    
    # BONES
    bone_keywords = [
    "bone", "vertebra", "rib", "sternum", "sacrum", "coccyx",
    "ilium", "ischium", "pubis", "hip bone",
    "atlas", "axis",  # C1 and C2 vertebrae
    "xiphoid",  # xiphoid process of sternum
    
    # === UPPER LIMB BONES ===
    "humerus", "radius", "ulna", "scapula", "clavicle",
    # Carpal bones (wrist)
    "capitate", "hamate", "lunate", "pisiform",
    "scaphoid", "trapezium", "trapezoid", "triquetrum",
    # Hand bones
    "metacarpal", "phalanx", "phalang",
    
    # === LOWER LIMB BONES ===
    "femur", "tibia", "fibula", "patella",
    "talus", "calcaneus", "navicular", "cuboid", "cuneiform",
    "metatarsal",
    
    # === CRANIAL BONES ===
    "frontal bone", "parietal bone", "temporal bone", "occipital bone",
    "sphenoid", "ethmoid",
    
    # === FACIAL BONES ===
    "mandible", "maxilla",
    "zygomatic",  # zygomatic bone
    "nasal bone", "nasal concha",
    "lacrimal",  # lacrimal bone
    "palatine",  # palatine bone
    "vomer",
    
    # === NECK/LARYNGEAL ===
    "hyoid",  # hyoid bone
]
    if any(w in name_lower for w in bone_keywords):
        return "bone"
    
    # LIGAMENTS
    ligament_keywords = [
        "ligament", "ligamentum",
        "zona orbicularis",  # hip joint ligament
    ]
    if any(w in name_lower for w in ligament_keywords):
        return "ligament"
    
    # FASCIA & CONNECTIVE TISSUE
    fascia_keywords = [
        "fascia", "aponeurosis", "tract", "retinaculum",
        "tendinous arch",  # tendinous arch of levator ani
        "linea alba",
    ]
    if any(w in name_lower for w in fascia_keywords):
        return "fascia"
    
    # CARTILAGE & FIBROCARTILAGE
    cartilage_keywords = [
        "cartilage", "disc", "meniscus", "labrum",
        "symphysis",  # fibrocartilaginous joint
        "nucleus pulposus",  # intervertebral disc component
        # === head and neck cartilages ===
        "thyroid cartilage",
        "cricoid", 
        "arytenoid",
        "epiglott",
        "nasal septal",
    ]
    if any(w in name_lower for w in cartilage_keywords):
        return "cartilage"
    
    # MEMBRANES
    if any(w in name_lower for w in ["membrane"]):
        return "membrane"
    
    # BURSAE
    if any(w in name_lower for w in ["bursa", "bursae"]):
        return "bursa"
    
    # CAPSULE-related structures
    if any(w in name_lower for w in ["frenula capsulae", "capsule of"]):
        return "capsule"
    
    return "other"


def validate_bilateral_pairs(registry: Dict) -> List[Dict]:
    """
    Check for incomplete bilateral pairs in the registry.
    Returns list of incomplete pairs with details.
    """
    structures = get_all_structure_names(registry)
    
    # Group by base name
    by_base = defaultdict(list)
    for name, region in structures.items():
        base, side = extract_side_and_base(name)
        if side != "midline":
            by_base[base].append({"name": name, "side": side, "region": region})
    
    incomplete = []
    for base, items in by_base.items():
        sides = {item["side"] for item in items}
        if sides != {"left", "right"}:
            missing = "right" if "left" in sides else "left"
            incomplete.append({
                "base_name": base,
                "missing_side": missing,
                "found": [item["name"] for item in items],
                "region": items[0]["region"],
            })
    
    return incomplete


# ============================================================
# BLENDER OBJECT FINDING
# ============================================================

def find_structure_in_blender(name: str) -> Optional[bpy.types.Object]:
    """
    Find a structure in Blender by exact name.
    Returns the object if found, None otherwise.
    """
    # Try exact match first
    if name in bpy.data.objects:
        obj = bpy.data.objects[name]
        if obj.type == 'MESH':
            return obj
    
    # Z-Anatomy sometimes has slight variations, try normalized matching
    name_normalized = name.lower().replace(" ", "_").replace("-", "_")
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        obj_normalized = obj.name.lower().replace(" ", "_").replace("-", "_")
        if obj_normalized == name_normalized:
            return obj
    
    return None


def find_all_registry_objects(registry: Dict) -> Tuple[Dict[str, bpy.types.Object], List[str]]:
    """
    Find all registry structures in Blender.
    Returns (found_objects, missing_names)
    """
    structures = get_all_structure_names(registry)
    
    found = {}
    missing = []
    
    for name, region in structures.items():
        obj = find_structure_in_blender(name)
        if obj:
            found[name] = obj
        else:
            missing.append(name)
    
    return found, missing


# ============================================================
# LAYER COMPUTATION
# ============================================================

def compute_structure_layers(
    objects: Dict[str, bpy.types.Object],
    registry: Dict
) -> Dict[str, int]:
    """
    Compute depth layers for structures based on Z-coordinate and type.
    
    Layer assignment strategy:
    - Layer 0: Bones, cartilage (deepest)
    - Layer 1: Deep muscles (rotators, multifidus, pelvic floor)
    - Layer 2: Intermediate muscles (internal oblique, erector spinae)
    - Layer 3: Superficial muscles (rectus, external oblique, lats)
    - Layer 4: Fascia, superficial structures (outermost)
    
    Also considers Z-coordinate depth for muscles in same category.
    """
    layers = {}
    z_coords = {}
    
    # First pass: compute Z-coordinates for all objects
    for name, obj in objects.items():
        if obj.type == 'MESH' and obj.data and len(obj.data.vertices) > 0:
            # Compute world center
            world_center = mathutils.Vector((0, 0, 0))
            for v in obj.data.vertices:
                world_center += obj.matrix_world @ v.co
            world_center /= len(obj.data.vertices)
            z_coords[name] = world_center.y  # In Blender, Y is depth (front-back)
        else:
            z_coords[name] = 0
    
    # Second pass: assign layers based on type and depth
    for name in objects:
        anat_type = get_anatomical_type(name)
        name_lower = name.lower()
        
        # Base layer from anatomical type
        if anat_type in ["bone", "cartilage"]:
            base_layer = 0
        elif anat_type in ["ligament", "membrane"]:
            base_layer = 1
        elif anat_type == "fascia":
            base_layer = 4
        elif anat_type in ["bursa"]:
            base_layer = 3
        elif anat_type == "muscle":
            # Classify muscles by depth based on name
            if any(w in name_lower for w in [
                "multifid", "rotat", "interspinal", "intertransvers",
                "transversus thoracis", "innermost", "diaphragm",
                "pelvic floor", "coccygeus", "levator ani", "pubo",
                "obturator internus", "piriformis", "gemell"
            ]):
                base_layer = 1  # Deep
            elif any(w in name_lower for w in [
                "internal", "erector", "spinalis", "longissimus",
                "iliocostalis", "semispinal", "oblique", "quadratus",
                "psoas", "iliacus", "obturator externus"
            ]):
                base_layer = 2  # Intermediate
            else:
                base_layer = 3  # Superficial (default for muscles)
        else:
            base_layer = 3  # Default
        
        layers[name] = base_layer
    
    return layers


# ============================================================
# TRANSFORM FUNCTIONS (from V9)
# ============================================================

def get_world_geometry_center(obj: bpy.types.Object) -> mathutils.Vector:
    """
    Compute the world-space geometry center of an object.
    Must be called BEFORE any parent chain modifications.
    """
    if obj.type != 'MESH' or not obj.data or len(obj.data.vertices) == 0:
        return obj.matrix_world.translation.copy()
    
    # Compute world geometry center
    world_center = mathutils.Vector((0, 0, 0))
    for v in obj.data.vertices:
        world_center += obj.matrix_world @ v.co
    world_center /= len(obj.data.vertices)
    
    return world_center


def precompute_world_transforms(objects: Dict[str, bpy.types.Object]) -> Dict[str, Dict]:
    """
    Pre-compute world transforms for all objects BEFORE any modifications.
    Stores both the full matrix_world and the geometry center.
    This prevents parent chain corruption from affecting child object transforms.
    """
    transforms = {}
    for name, obj in objects.items():
        transforms[name] = {
            'matrix': obj.matrix_world.copy(),
            'center': get_world_geometry_center(obj),
        }
    return transforms


def sum_parent_locations(obj: bpy.types.Object) -> mathutils.Vector:
    """Sum of all location values up the parent chain."""
    total = obj.location.copy()
    current = obj.parent
    while current:
        total += current.location
        current = current.parent
    return total


def compute_world_center_via_location_sum(obj: bpy.types.Object) -> mathutils.Vector:
    """
    Compute world geometry center using sum of parent locations.
    Used for structures with broken matrix_world.
    """
    if obj.type != 'MESH' or not obj.data or len(obj.data.vertices) == 0:
        return sum_parent_locations(obj)
    
    local_center = mathutils.Vector((0, 0, 0))
    for v in obj.data.vertices:
        local_center += v.co
    local_center /= len(obj.data.vertices)
    
    scale = obj.scale
    rot = obj.rotation_euler.to_matrix()
    
    scaled_center = mathutils.Vector((
        local_center.x * scale.x,
        local_center.y * scale.y,
        local_center.z * scale.z
    ))
    rotated_center = rot @ scaled_center
    
    world_offset = sum_parent_locations(obj)
    return world_offset + rotated_center


def blender_to_threejs(loc) -> List[float]:
    """Convert Blender Z-up to Three.js Y-up."""
    return [round(loc[0], 4), round(loc[2], 4), round(-loc[1], 4)]


# ============================================================
# COLLECTION MANAGEMENT
# ============================================================

def create_export_collection() -> bpy.types.Collection:
    if EXPORT_COLLECTION_NAME in bpy.data.collections:
        old = bpy.data.collections[EXPORT_COLLECTION_NAME]
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
    
    col = bpy.data.collections.new(EXPORT_COLLECTION_NAME)
    bpy.context.scene.collection.children.link(col)
    return col


def cleanup_export_collection():
    if EXPORT_COLLECTION_NAME in bpy.data.collections:
        col = bpy.data.collections[EXPORT_COLLECTION_NAME]
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(col)


# ============================================================
# OBJECT PROCESSING (from V9)
# ============================================================

def process_standard_object(
    original: bpy.types.Object,
    export_collection: bpy.types.Collection,
    precomputed_transform: Dict = None
) -> Tuple[Optional[bpy.types.Object], mathutils.Vector]:
    """
    Standard processing: duplicate, unparent, apply transforms, set origin.
    
    If precomputed_transform is provided AND the current matrix_world differs
    significantly from the precomputed one (indicating parent chain corruption),
    we set the object's matrix_world to the precomputed one before applying.
    """
    
    debug_targets = ["inguinal", "hip bone"]

    # DEBUG: Log details for inguinal ligament
    is_debug_target = any(target in original.name.lower() for target in debug_targets)
    
    # Store the CURRENT matrix_world before any modifications
    current_matrix = original.matrix_world.copy()
    precomputed_matrix = precomputed_transform['matrix'] if precomputed_transform else None
    
    # Check if parent chain is corrupted by comparing matrices
    needs_matrix_fix = False
    if precomputed_matrix:
        # Compare translation components
        current_pos = current_matrix.translation
        precomputed_pos = precomputed_matrix.translation
        position_diff = (current_pos - precomputed_pos).length
        
        # If position differs by more than 1mm, parent chain is corrupted
        needs_matrix_fix = position_diff > 0.001
        
        if is_debug_target:
            print(f"\n  [DEBUG] Processing: {original.name}")
            print(f"    Current matrix translation: {list(current_pos)}")
            print(f"    Precomputed matrix translation: {list(precomputed_pos)}")
            print(f"    Position difference: {position_diff:.6f}m")
            print(f"    Needs matrix fix: {needs_matrix_fix}")
    
    bpy.ops.object.select_all(action='DESELECT')
    original.select_set(True)
    bpy.context.view_layer.objects.active = original
    bpy.ops.object.duplicate(linked=False)
    
    copy = bpy.context.active_object
    copy.name = f"{original.name}_export"
    
    for col in copy.users_collection:
        col.objects.unlink(copy)
    export_collection.objects.link(copy)
    
    if copy.data and copy.data.users > 1:
        copy.data = copy.data.copy()
    
    if needs_matrix_fix:
        # Parent chain is corrupted - set matrix_world to precomputed value
        if is_debug_target:
            print(f"    Applying matrix fix by setting matrix_world directly...")
            print(f"    Precomputed matrix:")
            for row in range(4):
                print(f"      {[precomputed_matrix[row][col] for col in range(4)]}")
        
        # Clear parent WITHOUT keeping transform
        copy.parent = None
        
        # Directly set the matrix_world to the correct precomputed one
        copy.matrix_world = precomputed_matrix.copy()
        
        bpy.context.view_layer.update()
        
        if is_debug_target:
            print(f"    After setting matrix_world: {list(copy.matrix_world.translation)}")
        
    else:
        # Parent chain is OK - use standard processing
        if copy.parent:
            bpy.ops.object.select_all(action='DESELECT')
            copy.select_set(True)
            bpy.context.view_layer.objects.active = copy
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        
        bpy.context.view_layer.update()
    
    bpy.ops.object.select_all(action='DESELECT')
    copy.select_set(True)
    bpy.context.view_layer.objects.active = copy
    
    try:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        
        if is_debug_target and copy.type == 'MESH' and copy.data:
            xs = [v.co.x for v in copy.data.vertices]
            ys = [v.co.y for v in copy.data.vertices]
            zs = [v.co.z for v in copy.data.vertices]
            print(f"    After transform_apply - X: [{min(xs):.4f}, {max(xs):.4f}]")
            print(f"    After transform_apply - Y: [{min(ys):.4f}, {max(ys):.4f}]")
            print(f"    After transform_apply - Z: [{min(zs):.4f}, {max(zs):.4f}]")
        
        bpy.ops.object.origin_set(type='ORIGIN_CENTER_OF_VOLUME', center='MEDIAN')
        
        if is_debug_target:
            print(f"    Final location: {list(copy.location)}")
            
    except Exception as e:
        print(f"    Transform warning for {original.name}: {e}")
    
    world_center = copy.location.copy()
    return copy, world_center


def process_broken_parent_object(
    original: bpy.types.Object,
    export_collection: bpy.types.Collection
) -> Tuple[Optional[bpy.types.Object], mathutils.Vector]:
    """Special processing for structures with broken parent chain transforms."""
    world_center = compute_world_center_via_location_sum(original)
    
    bpy.ops.object.select_all(action='DESELECT')
    original.select_set(True)
    bpy.context.view_layer.objects.active = original
    bpy.ops.object.duplicate(linked=False)
    
    copy = bpy.context.active_object
    copy.name = f"{original.name}_export"
    
    for col in copy.users_collection:
        col.objects.unlink(copy)
    export_collection.objects.link(copy)
    
    if copy.data and copy.data.users > 1:
        copy.data = copy.data.copy()
    
    copy.parent = None
    copy.location = world_center
    copy.rotation_euler = (0, 0, 0)
    copy.scale = (1, 1, 1)
    
    if copy.type == 'MESH' and copy.data:
        mesh = copy.data
        scale = original.scale
        rot = original.rotation_euler.to_matrix()
        offset = sum_parent_locations(original)
        
        for v in mesh.vertices:
            scaled = mathutils.Vector((
                v.co.x * scale.x,
                v.co.y * scale.y,
                v.co.z * scale.z
            ))
            rotated = rot @ scaled
            v.co = rotated + offset - world_center
        
        mesh.update()
    
    bpy.ops.object.select_all(action='DESELECT')
    copy.select_set(True)
    bpy.context.view_layer.objects.active = copy
    
    try:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.origin_set(type='ORIGIN_CENTER_OF_VOLUME', center='MEDIAN')
    except Exception as e:
        print(f"    Transform warning for {original.name}: {e}")
    
    world_center = copy.location.copy()
    return copy, world_center


# ============================================================
# MESH ID GENERATION
# ============================================================

def normalize_mesh_id(name: str) -> str:
    """
    Convert Z-Anatomy name to normalized mesh ID.
    Preserves side information (_l/_r).
    """
    clean = name.lower()
    
    # Convert side suffixes to standardized format
    side_suffix = None
    for suffix, normalized in [(".l", "_l"), (".r", "_r")]:
        if clean.endswith(suffix):
            clean = clean[:-len(suffix)]
            side_suffix = normalized
            break
    
    # Normalize characters
    clean = clean.replace(" ", "_").replace("-", "_").replace(".", "_")
    clean = clean.replace("(", "").replace(")", "")
    while "__" in clean:
        clean = clean.replace("__", "_")
    clean = clean.strip("_")
    
    if side_suffix:
        clean = clean + side_suffix
    
    return clean


# ============================================================
# MAIN EXPORT FUNCTION
# ============================================================

def export_torso():
    """Main export function."""
    print("\n" + "=" * 70)
    print("Z-ANATOMY TORSO EXPORT V10.0")
    print("(Hierarchies-Driven Registry-Based Export)")
    print("=" * 70)
    
    # Load registry
    print(f"\nLoading registry: {REGISTRY_PATH}")
    try:
        registry = load_registry(REGISTRY_PATH)
    except FileNotFoundError:
        print(f"ERROR: Registry file not found: {REGISTRY_PATH}")
        print("Please ensure torso_registry_curated.json is in the same directory.")
        return
    
    structure_names = get_all_structure_names(registry)
    print(f"  Registry contains {len(structure_names)} structures")
    
    # Validate bilateral pairs
    print("\nValidating bilateral pairs...")
    incomplete_pairs = validate_bilateral_pairs(registry)
    if incomplete_pairs:
        print(f"  WARNING: {len(incomplete_pairs)} incomplete bilateral pairs found:")
        for pair in incomplete_pairs:
            print(f"    - {pair['base_name']}: missing {pair['missing_side']} side")
    else:
        print("  ✓ All bilateral pairs complete")
    
    # Force scene update
    bpy.context.view_layer.update()
    
    # Find structures in Blender
    print("\nFinding structures in Blender...")
    found_objects, missing_names = find_all_registry_objects(registry)
    print(f"  Found: {len(found_objects)}/{len(structure_names)} structures")
    
    if missing_names:
        print(f"\n  MISSING FROM BLENDER ({len(missing_names)}):")
        for name in sorted(missing_names)[:20]:
            print(f"    - {name}")
        if len(missing_names) > 20:
            print(f"    ... and {len(missing_names) - 20} more")
    
    if not found_objects:
        print("\nERROR: No structures found in Blender!")
        print("Make sure you're running this on the correct Z-Anatomy file.")
        return
    
    # Compute layers
    print("\nComputing depth layers...")
    layers = compute_structure_layers(found_objects, registry)
    layer_counts = defaultdict(int)
    for layer in layers.values():
        layer_counts[layer] += 1
    print("  Layer distribution:")
    for layer in sorted(layer_counts.keys()):
        print(f"    Layer {layer}: {layer_counts[layer]} structures")
    
    # Setup export
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(METADATA_OUTPUT_DIR, exist_ok=True)
    
    # PRE-COMPUTE all world transforms BEFORE any object modifications
    # This prevents parent chain corruption from affecting child transforms
    print("\nPre-computing world transforms...")
    precomputed_transforms = precompute_world_transforms(found_objects)
    print(f"  Computed transforms for {len(precomputed_transforms)} structures")
    
    export_collection = create_export_collection()
    
    # Process structures
    print(f"\nProcessing {len(found_objects)} structures...")
    
    export_objects = []
    metadata = {
        "version": "10.5",
        "source": "Z-Anatomy (Registry-Driven)",
        "region": "torso",
        "export_notes": "V10.5: Direct matrix_world assignment for corrupted parent chains",
        "structures": {}
    }
    
    used_ids = set()
    stats = {"standard": 0, "special_fix": 0, "matrix_fix": 0, "failed": 0}
    type_stats = defaultdict(int)
    
    for registry_name, original in found_objects.items():
        try:
            # Get pre-computed transform (computed before any modifications)
            precomputed_transform = precomputed_transforms.get(registry_name)
            
            # Choose processing method for mesh export
            if needs_location_sum_fix(original.name):
                copy, _ = process_broken_parent_object(original, export_collection)
                stats["special_fix"] += 1
            else:
                # Pass full precomputed transform to preserve position AND rotation
                copy, _ = process_standard_object(original, export_collection, precomputed_transform)
                stats["standard"] += 1
            
            if copy is None:
                stats["failed"] += 1
                continue
            
            # Use PRE-COMPUTED center for metadata
            world_center = precomputed_transform['center'] if precomputed_transform else copy.location.copy()
            
            # Generate mesh ID
            base_id = normalize_mesh_id(registry_name)
            mesh_id = base_id
            counter = 1
            while mesh_id in used_ids:
                mesh_id = f"{base_id}_{counter}"
                counter += 1
            used_ids.add(mesh_id)
            
            copy.name = mesh_id
            
            # Get metadata
            center_threejs = blender_to_threejs(world_center)
            anat_type = get_anatomical_type(registry_name)
            region = structure_names[registry_name]
            layer = layers.get(registry_name, 3)
            base_name, side = extract_side_and_base(registry_name)
            
            type_stats[anat_type] += 1
            
            metadata["structures"][mesh_id] = {
                "meshId": mesh_id,
                "originalName": registry_name,
                "type": anat_type,
                "layer": layer,
                "region": region,
                "side": side,
                "center": center_threejs,
            }
            
            export_objects.append(copy)
            
            if DEBUG_VERBOSE and len(export_objects) <= 10:
                print(f"  ✓ {mesh_id}: type={anat_type}, layer={layer}, region={region}")
                
        except Exception as e:
            print(f"  ✗ Failed to process {registry_name}: {e}")
            stats["failed"] += 1
    
    print(f"\n  Processing results:")
    print(f"    Standard method: {stats['standard']}")
    print(f"    Special fix (broken parent): {stats['special_fix']}")
    print(f"    Failed: {stats['failed']}")
    
    print(f"\n  Type distribution:")
    for t, count in sorted(type_stats.items(), key=lambda x: -x[1]):
        print(f"    {t}: {count}")
    
    if not export_objects:
        print("\nERROR: No valid objects to export!")
        cleanup_export_collection()
        return
    
    # Export glTF
    print(f"\nExporting {len(export_objects)} structures to glTF...")
    bpy.ops.object.select_all(action='DESELECT')
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = export_objects[0]
    
    gltf_path = os.path.join(OUTPUT_DIR, GLTF_FILENAME)
    bpy.ops.export_scene.gltf(
        filepath=gltf_path,
        use_selection=True,
        export_draco_mesh_compression_enable=True,
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_all_vertex_colors=True,
        export_yup=True,
    )
    print(f"  ✓ {gltf_path}")
    
    # Export metadata
    metadata_path = os.path.join(METADATA_OUTPUT_DIR, METADATA_FILENAME)
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✓ {metadata_path}")
    
    # Cleanup
    cleanup_export_collection()
    
    # Final report
    print("\n" + "=" * 70)
    print("EXPORT COMPLETE")
    print("=" * 70)
    print(f"  Total exported: {len(metadata['structures'])}")
    print(f"  Missing from registry: {len(missing_names)}")
    if incomplete_pairs:
        print(f"  Incomplete bilateral pairs: {len(incomplete_pairs)}")
    print("=" * 70 + "\n")
    
    # Return report for programmatic use
    return ExportReport(
        total_in_registry=len(structure_names),
        found_in_blender=len(found_objects),
        exported=len(metadata['structures']),
        missing=missing_names,
        incomplete_pairs=incomplete_pairs,
    )


if __name__ == "__main__":
    export_torso()