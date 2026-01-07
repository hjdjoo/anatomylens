"""
Z-Anatomy Export Script - Bilateral Mirroring
Version 11.0 - Exports only left-side + midline structures for runtime mirroring

MAJOR CHANGES FROM V10.4:
- Only exports left-side (.l) and midline structures
- Right-side structures are mirrored at runtime in the viewer
- Adds 'bilateral' field to metadata to indicate mirrorable structures
- Mesh IDs use base names (without _l suffix) for bilateral structures
- ~40-50% reduction in GLB file size

APPROACH:
1. Load curated structure registry
2. Filter to left-side (.l) and midline structures only
3. For bilateral structures:
   - Export only the left mesh
   - Compute mirrored center for right side (negate X)
   - Mark as bilateral: true in metadata
4. Export glTF and metadata with bilateral flags

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

OUTPUT_DIR = os.path.expanduser("~/Code/anatomylens/public/models")
METADATA_OUTPUT_DIR = os.path.expanduser("~/Code/anatomylens/data")

GLTF_FILENAME = "body.glb"
METADATA_FILENAME = "body_metadata.json"

# Path to the curated structure registry
REGISTRY_PATH = os.path.expanduser("~/Code/anatomylens/data/body_registry.json")

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
    bilateral_count: int = 0
    midline_count: int = 0
    missing: List[str] = None
    skipped_right: List[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.missing is None:
            self.missing = []
        if self.skipped_right is None:
            self.skipped_right = []
        if self.warnings is None:
            self.warnings = []


# ============================================================
# STRUCTURES THAT NEED SPECIAL HANDLING
# ============================================================

BROKEN_PARENT_CHAIN_PATTERNS = [
    # "inferior pubic ligament",
    # "superior pubic ligament",
    # "interpubic disc",
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
    """
    structures = {}
    for region, data in registry.items():
        if region.startswith("_"):  # Skip metadata
            continue
        
        if isinstance(data, dict):
            if "structures" in data:
                for name in data["structures"]:
                    structures[name] = region
            elif "description" not in data:
                for name in data:
                    structures[name] = region
        elif isinstance(data, list):
            for name in data:
                structures[name] = region
    
    return structures


# ============================================================
# BILATERAL STRUCTURE ANALYSIS
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


def find_bilateral_pairs(structure_names: Dict[str, str]) -> Dict[str, Dict]:
    """
    Identify bilateral pairs in the registry.
    Returns dict mapping base_name -> {left: name, right: name, region: str}
    """
    by_base = defaultdict(lambda: {"left": None, "right": None, "region": None})
    
    for name, region in structure_names.items():
        base, side = extract_side_and_base(name)
        if side == "left":
            by_base[base]["left"] = name
            by_base[base]["region"] = region
        elif side == "right":
            by_base[base]["right"] = name
            by_base[base]["region"] = region
    
    # Filter to only complete pairs
    bilateral_pairs = {}
    for base, info in by_base.items():
        if info["left"] and info["right"]:
            bilateral_pairs[base] = info
    
    return bilateral_pairs


def filter_for_export(
    structure_names: Dict[str, str],
    bilateral_pairs: Dict[str, Dict]
) -> Tuple[Dict[str, str], List[str]]:
    """
    Filter structures to only left-side and midline.
    Returns (filtered_structures, skipped_right_names)
    """
    filtered = {}
    skipped = []
    
    for name, region in structure_names.items():
        base, side = extract_side_and_base(name)
        
        if side == "right":
            # Skip right-side of bilateral pairs - will be mirrored at runtime
            if base in bilateral_pairs:
                skipped.append(name)
                continue
            # If no left counterpart exists, include the right (orphan)
            filtered[name] = region
        else:
            # Include left-side and midline
            filtered[name] = region
    
    return filtered, skipped


# ============================================================
# ANATOMICAL TYPE DETECTION
# ============================================================

def get_anatomical_type(name: str) -> str:
    """
    Determine anatomical type from structure name.
    """
    name_lower = name.lower()

    # FASCIA
    fascia_keywords = ["fascia", "aponeurosis", "tract", "retinaculum", "tendinous arch",]
    if any(w in name_lower for w in fascia_keywords):
        return "fascia"
    
    # TENDONS & TENDON SHEATHS
    if any(w in name_lower for w in ["tendon", "sheath"]):
        return "tendon"
    
    # JOINT CAPSULES
    if "articular capsule" in name_lower or "capsule" in name_lower:
        return "capsule"
    
    # MUSCLES
    muscle_keywords = [
        "muscle", "muscul",
        "abdominis", "dorsi", "oblique", "diaphragm",
        "levator", "rotator",
        "brachii", "brachialis", "coracobrachialis",
        "deltoid", "supinator", "pronator",
        "pollicis", "indicis", "digiti",
        "interossei", "lumbrical", "opponens",
        "flexor carpi", "extensor carpi",
        "flexor digitorum", "extensor digitorum",
        "femoris", "gastrocnemius", "soleus",
        "adductor", "obturator", "sphincter",
        "hallucis", "psoas",
        "frontalis", "occipitalis", "temporoparietalis",
        "orbicularis", "corrugator", "procerus",
        "nasalis", "depressor", "zygomaticus",
        "risorius", "mentalis", "buccinator", "platysma",
        "masseter", "temporalis", "pterygoid",
        "genioglossus", "hyoglossus", "styloglossus", "palatoglossus",
        "digastric", "mylohyoid", "geniohyoid", "stylohyoid",
        "sternohyoid", "sternothyroid", "thyrohyoid", "omohyoid",
        "constrictor", "palatopharyngeus", "stylopharyngeus", "salpingopharyngeus",
        "cricothyroid", "thyroarytenoid", "thyro-arytenoid",
        "cricoarytenoid", "crico-arytenoid",
        "aryepiglottic", "ary-epiglottic", "vocalis",
        "sternocleidomastoid", "scalenus",
        "longus colli", "longus capitis",
        "splenius", "semispinalis",
        "rectus capitis", "obliquus capitis",
        "rectus superior", "rectus inferior",
        "rectus medialis", "rectus lateralis",
        "oblique muscle", "levator palpebrae",
    ]
    if any(w in name_lower for w in muscle_keywords):
        return "muscle"
    
    # BONES
    bone_keywords = [
        "bone", "vertebra", "rib", "sternum", "sacrum", "coccyx",
        "ilium", "ischium", "pubis", "hip bone",
        "atlas", "axis", "xiphoid",
        "humerus", "radius", "ulna", "scapula", "clavicle",
        "capitate", "hamate", "lunate", "pisiform",
        "scaphoid", "trapezium", "trapezoid", "triquetrum",
        "metacarpal", "phalanx", "phalang",
        "femur", "tibia", "fibula", "patella",
        "talus", "calcaneus", "navicular", "cuboid", "cuneiform",
        "metatarsal",
        "frontal bone", "parietal bone", "temporal bone", "occipital bone",
        "sphenoid", "ethmoid",
        "mandible", "maxilla", "zygomatic", "nasal bone", "nasal concha",
        "lacrimal", "palatine", "vomer", "hyoid",
    ]
    if any(w in name_lower for w in bone_keywords):
        return "bone"
    
    # LIGAMENTS
    ligament_keywords = ["ligament", "ligamentum", "zona orbicularis"]
    if any(w in name_lower for w in ligament_keywords):
        return "ligament"
    
    
    # CARTILAGE
    cartilage_keywords = [
        "cartilage", "disc", "meniscus", "labrum", "symphysis",
        "nucleus pulposus", "thyroid cartilage", "cricoid", 
        "arytenoid", "epiglott", "nasal septal",
    ]
    if any(w in name_lower for w in cartilage_keywords):
        return "cartilage"
    
    # MEMBRANES
    if "membrane" in name_lower:
        return "membrane"
    
    # BURSAE
    if any(w in name_lower for w in ["bursa", "bursae"]):
        return "bursa"
    
    # CAPSULE
    if any(w in name_lower for w in ["frenula capsulae", "capsule of"]):
        return "capsule"
    
    return "other"


# ============================================================
# LAYER COMPUTATION
# ============================================================

def compute_structure_layers(
    objects: Dict[str, bpy.types.Object],
    registry: Dict
) -> Dict[str, int]:
    """
    Compute depth layers for structures.
    """
    layers = {}
    
    for name in objects:
        anat_type = get_anatomical_type(name)
        name_lower = name.lower()
        
        if anat_type in ["bone", "cartilage"]:
            base_layer = 0
        elif anat_type in ["ligament", "membrane"]:
            base_layer = 1
        elif anat_type == "fascia":
            base_layer = 4
        elif anat_type in ["bursa"]:
            base_layer = 3
        elif anat_type == "muscle":
            if any(w in name_lower for w in [
                "multifid", "rotat", "interspinal", "intertransvers",
                "transversus thoracis", "innermost", "diaphragm",
                "pelvic floor", "coccygeus", "levator ani", "pubo",
                "obturator internus", "piriformis", "gemell"
            ]):
                base_layer = 1
            elif any(w in name_lower for w in [
                "internal", "erector", "spinalis", "longissimus",
                "iliocostalis", "semispinal", "oblique", "quadratus",
                "psoas", "iliacus", "obturator externus"
            ]):
                base_layer = 2
            else:
                base_layer = 3
        else:
            base_layer = 3
        
        layers[name] = base_layer
    
    return layers


# ============================================================
# BLENDER OBJECT FINDING
# ============================================================

def find_structure_in_blender(name: str) -> Optional[bpy.types.Object]:
    """Find a structure in Blender by exact name."""
    if name in bpy.data.objects:
        obj = bpy.data.objects[name]
        if obj.type == 'MESH':
            return obj
    
    name_normalized = name.lower().replace(" ", "_").replace("-", "_")
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        obj_normalized = obj.name.lower().replace(" ", "_").replace("-", "_")
        if obj_normalized == name_normalized:
            return obj
    
    return None


def find_all_registry_objects(registry_names: Dict[str, str]) -> Tuple[Dict[str, bpy.types.Object], List[str]]:
    """Find all registry structures in Blender."""
    found = {}
    missing = []
    
    for name, region in registry_names.items():
        obj = find_structure_in_blender(name)
        if obj:
            found[name] = obj
        else:
            missing.append(name)
    
    return found, missing


# ============================================================
# TRANSFORM FUNCTIONS
# ============================================================

def get_world_geometry_center(obj: bpy.types.Object) -> mathutils.Vector:
    """Compute the world-space geometry center of an object."""
    if obj.type != 'MESH' or not obj.data or len(obj.data.vertices) == 0:
        return obj.matrix_world.translation.copy()
    
    world_center = mathutils.Vector((0, 0, 0))
    for v in obj.data.vertices:
        world_center += obj.matrix_world @ v.co
    world_center /= len(obj.data.vertices)
    
    return world_center


def precompute_world_transforms(objects: Dict[str, bpy.types.Object]) -> Dict[str, Dict]:
    """Pre-compute world transforms for all objects."""
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
    """Compute world geometry center using sum of parent locations."""
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


def mirror_center_x(center: List[float]) -> List[float]:
    """Mirror a center position across the X axis (for bilateral structures)."""
    return [-center[0], center[1], center[2]]


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
# OBJECT PROCESSING
# ============================================================

def process_standard_object(
    original: bpy.types.Object,
    export_collection: bpy.types.Collection,
    precomputed_transform: Dict = None
) -> Tuple[Optional[bpy.types.Object], mathutils.Vector]:
    """Standard processing: duplicate, unparent, apply transforms, set origin."""
    
    current_matrix = original.matrix_world.copy()
    precomputed_matrix = precomputed_transform['matrix'] if precomputed_transform else None
    
    needs_matrix_fix = False
    if precomputed_matrix:
        current_pos = current_matrix.translation
        precomputed_pos = precomputed_matrix.translation
        position_diff = (current_pos - precomputed_pos).length
        needs_matrix_fix = position_diff > 0.001
    
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
        copy.parent = None
        copy.matrix_world = precomputed_matrix.copy()
        bpy.context.view_layer.update()
    else:
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
        bpy.ops.object.origin_set(type='ORIGIN_CENTER_OF_VOLUME', center='MEDIAN')
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

def normalize_mesh_id(name: str, is_bilateral: bool = False) -> str:
    """
    Convert Z-Anatomy name to normalized mesh ID.
    For bilateral structures, strips the side suffix to use base name.
    """
    clean = name.lower()
    
    # For bilateral structures, remove side suffix entirely
    # For non-bilateral (orphan or midline), preserve it
    if is_bilateral:
        for suffix in [".l", ".r"]:
            if clean.endswith(suffix):
                clean = clean[:-len(suffix)]
                break
    else:
        # Preserve side suffix for non-bilateral
        side_suffix = None
        for suffix, normalized in [(".l", "_l"), (".r", "_r")]:
            if clean.endswith(suffix):
                clean = clean[:-len(suffix)]
                side_suffix = normalized
                break
        
        if side_suffix:
            # Normalize then add suffix back
            clean = clean.replace(" ", "_").replace("-", "_").replace(".", "_")
            clean = clean.replace("(", "").replace(")", "")
            while "__" in clean:
                clean = clean.replace("__", "_")
            clean = clean.strip("_")
            return clean + side_suffix
    
    # Normalize characters
    clean = clean.replace(" ", "_").replace("-", "_").replace(".", "_")
    clean = clean.replace("(", "").replace(")", "")
    while "__" in clean:
        clean = clean.replace("__", "_")
    clean = clean.strip("_")
    
    return clean


# ============================================================
# MAIN EXPORT FUNCTION
# ============================================================

def export_torso():
    """Main export function with bilateral mirroring support."""
    print("\n" + "=" * 70)
    print("Z-ANATOMY EXPORT V11.0")
    print("(Bilateral Mirroring - Left-side + Midline Only)")
    print("=" * 70)
    
    # Load registry
    print(f"\nLoading registry: {REGISTRY_PATH}")
    try:
        registry = load_registry(REGISTRY_PATH)
    except FileNotFoundError:
        print(f"ERROR: Registry file not found: {REGISTRY_PATH}")
        return
    
    all_structure_names = get_all_structure_names(registry)
    print(f"  Registry contains {len(all_structure_names)} total structures")
    
    # Identify bilateral pairs
    print("\nAnalyzing bilateral pairs...")
    bilateral_pairs = find_bilateral_pairs(all_structure_names)
    print(f"  Found {len(bilateral_pairs)} bilateral pairs")
    
    # Filter to left-side + midline only
    print("\nFiltering for export (left-side + midline)...")
    export_structure_names, skipped_right = filter_for_export(all_structure_names, bilateral_pairs)
    print(f"  Structures to export: {len(export_structure_names)}")
    print(f"  Right-side skipped (will mirror): {len(skipped_right)}")
    
    # Force scene update
    bpy.context.view_layer.update()
    
    # Find structures in Blender
    print("\nFinding structures in Blender...")
    found_objects, missing_names = find_all_registry_objects(export_structure_names)
    print(f"  Found: {len(found_objects)}/{len(export_structure_names)} structures")
    
    if missing_names:
        print(f"\n  MISSING FROM BLENDER ({len(missing_names)}):")
        for name in sorted(missing_names)[:20]:
            print(f"    - {name}")
        if len(missing_names) > 20:
            print(f"    ... and {len(missing_names) - 20} more")
    
    if not found_objects:
        print("\nERROR: No structures found in Blender!")
        return
    
    # Compute layers
    print("\nComputing depth layers...")
    layers = compute_structure_layers(found_objects, registry)
    
    # Setup export
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(METADATA_OUTPUT_DIR, exist_ok=True)
    
    # Pre-compute transforms
    print("\nPre-computing world transforms...")
    precomputed_transforms = precompute_world_transforms(found_objects)
    
    export_collection = create_export_collection()
    
    # Process structures
    print(f"\nProcessing {len(found_objects)} structures...")
    
    export_objects = []
    metadata = {
        "version": "11.0",
        "source": "Z-Anatomy (Bilateral Mirroring)",
        "region": "full_body",
        "export_notes": "V11.0: Left-side + midline only. Bilateral structures mirrored at runtime.",
        "bilateral_count": 0,
        "midline_count": 0,
        "structures": {}
    }
    
    used_ids = set()
    stats = {"bilateral": 0, "midline": 0, "orphan": 0, "failed": 0}
    type_stats = defaultdict(int)
    
    for registry_name, original in found_objects.items():
        try:
            precomputed_transform = precomputed_transforms.get(registry_name)
            
            # Process mesh
            if needs_location_sum_fix(original.name):
                copy, _ = process_broken_parent_object(original, export_collection)
            else:
                copy, _ = process_standard_object(original, export_collection, precomputed_transform)
            
            if copy is None:
                stats["failed"] += 1
                continue
            
            # Use pre-computed center
            world_center = precomputed_transform['center'] if precomputed_transform else copy.location.copy()
            
            # Determine if bilateral
            base_name, side = extract_side_and_base(registry_name)
            is_bilateral = base_name in bilateral_pairs
            
            # Generate mesh ID (use base name for bilateral)
            base_id = normalize_mesh_id(registry_name, is_bilateral=is_bilateral)
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
            region = export_structure_names[registry_name]
            layer = layers.get(registry_name, 3)
            
            type_stats[anat_type] += 1
            
            # Build structure metadata
            structure_meta = {
                "meshId": mesh_id,
                "originalName": registry_name,
                "baseName": base_name,
                "type": anat_type,
                "layer": layer,
                "region": region,
                "bilateral": is_bilateral,
                "center": center_threejs,
            }
            
            # For bilateral structures, add mirrored center
            if is_bilateral:
                structure_meta["mirroredCenter"] = mirror_center_x(center_threejs)
                stats["bilateral"] += 1
            elif side == "midline":
                stats["midline"] += 1
            else:
                stats["orphan"] += 1  # Left or right without counterpart
            
            metadata["structures"][mesh_id] = structure_meta
            export_objects.append(copy)
            
            if DEBUG_VERBOSE and len(export_objects) <= 10:
                bilateral_tag = " [bilateral]" if is_bilateral else ""
                print(f"  ✓ {mesh_id}: type={anat_type}, layer={layer}{bilateral_tag}")
                
        except Exception as e:
            print(f"  ✗ Failed to process {registry_name}: {e}")
            stats["failed"] += 1
    
    # Update metadata counts
    metadata["bilateral_count"] = stats["bilateral"]
    metadata["midline_count"] = stats["midline"]
    
    print(f"\n  Processing results:")
    print(f"    Bilateral (will mirror): {stats['bilateral']}")
    print(f"    Midline: {stats['midline']}")
    print(f"    Orphan (one-sided): {stats['orphan']}")
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
    print(f"  Total exported meshes: {len(metadata['structures'])}")
    print(f"  Bilateral structures: {stats['bilateral']} (will appear as {stats['bilateral'] * 2} in viewer)")
    print(f"  Estimated file size reduction: ~{round(stats['bilateral'] / len(metadata['structures']) * 100)}%")
    print("=" * 70 + "\n")
    
    return ExportReport(
        total_in_registry=len(all_structure_names),
        found_in_blender=len(found_objects),
        exported=len(metadata['structures']),
        bilateral_count=stats['bilateral'],
        midline_count=stats['midline'],
        missing=missing_names,
        skipped_right=skipped_right,
    )


if __name__ == "__main__":
    export_torso()