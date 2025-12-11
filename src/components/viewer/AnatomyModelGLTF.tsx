import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnatomyStore } from '@/store';
import type { LayerVisibility } from '@/types';

// Import the metadata
import torsoMetadata from '@/data/torso_metadata.json';

// ============================================================
// TYPES
// ============================================================

interface StructureMetadata {
  meshId: string;
  originalName: string;
  type: 'bone' | 'muscle' | 'organ' | 'tendon' | 'ligament' | 'cartilage' | 'fascia';
  layer: number;
  regions: string[];
  center: [number, number, number];
}

interface MetadataFile {
  version: string;
  source: string;
  region: string;
  structures: Record<string, StructureMetadata>;
}

// ============================================================
// CONSTANTS
// ============================================================

// Color palette by structure type
const TYPE_COLORS: Record<string, { default: string; highlight: string }> = {
  bone: { default: '#E8DCC4', highlight: '#FFF8E7' },
  muscle: { default: '#C41E3A', highlight: '#FF4D6A' },
  organ: { default: '#8B4557', highlight: '#A85A6F' },
  tendon: { default: '#D4A574', highlight: '#E8C9A0' },
  ligament: { default: '#8B7355', highlight: '#A89070' },
  cartilage: { default: '#A8D5BA', highlight: '#C5E8D2' },
  fascia: { default: '#D4A5A5', highlight: '#E8C5C5' },
};

// Map structure types to layer visibility keys
const TYPE_TO_VISIBILITY_KEY: Record<string, keyof LayerVisibility> = {
  bone: 'bones',
  muscle: 'muscles',
  organ: 'organs',
  tendon: 'tendons',
  ligament: 'ligaments',
  cartilage: 'bones', // Group with bones
  fascia: 'muscles', // Group with muscles
};

// ============================================================
// STRUCTURE FILTERING
// ============================================================

// Bounding box for valid torso structures
// Metadata is in Blender coordinates: [X, Y, Z] where Z is height (up/down)
// const TORSO_BOUNDS = {
//   minX: -0.20,  // Left boundary
//   maxX: 0.20,   // Right boundary  
//   minZ: 0.70,   // Bottom height (pelvis) - note: Z is height in Blender coords
//   maxZ: 1.50,   // Top height (below neck)
// };

// Patterns that indicate non-anatomical or non-torso structures
const EXCLUDE_NAME_PATTERNS = [
  // Reference planes and movement terms (teaching aids, not anatomy)
  'plane', 'planes', 'flexion', 'extension', 'rotation', 'abduction',
  'adduction', 'pronation', 'supination', 'circumduction',

  // Eye muscles (matched "rectus" and "oblique" too broadly)
  'lateral_rectus_muscle', 'medial_rectus_muscle', 'superior_rectus_muscle',
  'inferior_rectus_muscle', 'superior_oblique_muscle', 'inferior_oblique_muscle',

  // Forearm structures
  'pronator_quadratus', 'pronator_teres', 'supinator',
  'oblique_cord',

  // Foot structures (matched "quadratus" too broadly)
  'plantae',

  // Leg structures below pelvis
  'popliteal', 'femoris', 'tibial', 'fibular', 'peroneal',
  'gastrocnemius', 'soleus', 'plantaris',

  // Lymph nodes (usually just labels)
  'lymph_node',
];

// Z-Anatomy uses various suffix patterns for different visualization layers.
// Many of these have broken transforms (rotated 180°, wrong position).
// Primary filtering is done in Blender export, but we keep this as a safety net.
//
// Patterns to EXCLUDE (have broken transforms or data quality issues):
//   - _i (geometry data at origin instead of correct position)
//   - _ol, _or (outline left/right)
//   - _el, _er (external left/right)
//   - _o1l, _o2r, _e19l etc. (numbered layer variants)
const EXCLUDE_SUFFIX_PATTERNS = [
  /_i$/i,          // Broken geometry position (data at origin)
  /_o\d*[lr]$/i,   // _ol, _or, _o1l, _o2r, _o19l, etc.
  /_e\d+[lr]$/i,   // _e1l, _e2r, _e19l, etc. (numbered e variants)
  /_el$/i,         // _el (even unnumbered - many are broken)
  /_er$/i,         // _er (even unnumbered - many are broken)
];

// Types to exclude entirely
const EXCLUDE_TYPES = ['organ'];

/**
 * Determine if a structure should be rendered based on type and name.
 * Only renders "clean" structures without problematic Z-Anatomy suffixes.
 */
function shouldRenderByTypeAndName(metadata: StructureMetadata): boolean {
  // Exclude certain types entirely (like organs)
  if (EXCLUDE_TYPES.includes(metadata.type)) {
    return false;
  }

  const nameLower = metadata.meshId.toLowerCase();

  // Check name patterns
  if (EXCLUDE_NAME_PATTERNS.some(pattern => nameLower.includes(pattern))) {
    return false;
  }

  // Check suffix patterns (Z-Anatomy layer variants with broken transforms)
  if (EXCLUDE_SUFFIX_PATTERNS.some(pattern => pattern.test(metadata.meshId))) {
    return false;
  }

  return true;
}

/**
 * Check if a structure is within torso bounds based on metadata center.
 * Metadata center is in Blender coordinates: [X, Y, Z] where Z is height
 */
// function isInTorsoBounds(metadata: StructureMetadata): boolean {
//   const [x, , z] = metadata.center; // X = left/right, Z = height (Blender Z-up)

//   if (x < TORSO_BOUNDS.minX || x > TORSO_BOUNDS.maxX) {
//     return false;
//   }

//   if (z < TORSO_BOUNDS.minZ || z > TORSO_BOUNDS.maxZ) {
//     return false;
//   }

//   return true;
// }

// ============================================================
// STRUCTURE MESH COMPONENT
// ============================================================

interface StructureMeshProps {
  mesh: THREE.Mesh;
  metadata: StructureMetadata;
}

function StructureMesh({ mesh, metadata }: StructureMeshProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Current animated opacity for smooth transitions
  const animatedOpacity = useRef(1);

  const {
    hoveredStructureId,
    selectedStructureId,
    setHoveredStructure,
    setSelectedStructure,
    layerVisibility,
    peelDepth,
    searchQuery,
  } = useAnatomyStore();

  const colors = TYPE_COLORS[metadata.type] || TYPE_COLORS.muscle;
  const isSelected = selectedStructureId === metadata.meshId;

  // Check if this structure matches the search query
  const matchesSearch = searchQuery.length > 1 && (
    metadata.meshId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    metadata.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isHighlighted = hovered || isSelected || hoveredStructureId === metadata.meshId || matchesSearch;

  // Check visibility based on structure type
  const visibilityKey = TYPE_TO_VISIBILITY_KEY[metadata.type] || 'muscles';
  const isTypeVisible = layerVisibility[visibilityKey];

  // Depth peeling logic
  const maxVisibleLayer = 3 - peelDepth;
  const isPeeled = metadata.layer > maxVisibleLayer;

  // Search matches override peeling
  const shouldPeel = isPeeled && !matchesSearch;

  // Target opacity based on peel state
  const targetOpacity = shouldPeel ? 0 : (metadata.type === 'bone' ? 1 : 0.9);

  // Create material once
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: colors.default,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: metadata.type === 'bone' ? 1 : 0.9,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
  }, [colors.default, metadata.type]);

  // Animate color and opacity
  useFrame(() => {
    if (!materialRef.current) return;

    // Animate color
    let targetColor = colors.default;
    if (matchesSearch) {
      targetColor = '#FFD700';
    } else if (isHighlighted && !shouldPeel) {
      targetColor = colors.highlight;
    }
    materialRef.current.color.lerp(new THREE.Color(targetColor), 0.1);

    // Animate opacity
    animatedOpacity.current += (targetOpacity - animatedOpacity.current) * 0.08;
    materialRef.current.opacity = animatedOpacity.current;
    materialRef.current.depthWrite = animatedOpacity.current > 0.5;
  });

  // Don't render if type is hidden
  if (!isTypeVisible) return null;

  const isInteractive = animatedOpacity.current > 0.1;

  // Geometry is already in world space (transforms baked in), so render at origin
  return (
    <mesh
      ref={meshRef}
      geometry={mesh.geometry}
      raycast={isInteractive ? undefined : () => { }}
      onPointerOver={(e) => {
        if (!isInteractive) return;
        e.stopPropagation();
        setHovered(true);
        setHoveredStructure(metadata.meshId);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        if (!isInteractive) return;
        e.stopPropagation();
        setHovered(false);
        setHoveredStructure(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        if (!isInteractive) return;
        e.stopPropagation();
        setSelectedStructure(isSelected ? null : metadata.meshId);
      }}
    >
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
}

// ============================================================
// MAIN ANATOMY MODEL COMPONENT
// ============================================================

export function AnatomyModelGLTF() {
  const { scene } = useGLTF('/models/torso.glb');
  const clearSelection = useAnatomyStore((state) => state.clearSelection);
  const setLoading = useAnatomyStore((state) => state.setLoading);

  // Parse metadata
  const metadata = JSON.parse(JSON.stringify(torsoMetadata)) as MetadataFile;

  // Extract meshes and match with metadata
  const meshEntries = useMemo(() => {
    const entries: Array<{ mesh: THREE.Mesh; metadata: StructureMetadata }> = [];
    let skippedByTypeOrName = 0;

    // First, update the world matrices for the entire scene
    scene.updateMatrixWorld(true);

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Try to find matching metadata
        const meshName = child.name;
        const structureData = metadata.structures[meshName];

        if (structureData) {
          // Filter by type, name patterns, and suffix patterns
          if (!shouldRenderByTypeAndName(structureData)) {
            skippedByTypeOrName++;
            return;
          }

          // Clone the geometry and apply the world transform
          // This bakes all parent transforms into the vertex data
          const clonedGeometry = child.geometry.clone();
          clonedGeometry.applyMatrix4(child.matrixWorld);

          // Create a new mesh with the transformed geometry at origin
          const newMesh = new THREE.Mesh(clonedGeometry);
          newMesh.name = child.name;

          entries.push({
            mesh: newMesh,
            metadata: structureData,
          });
        } else {
          // Log unmatched meshes for debugging
          console.debug(`No metadata for mesh: ${meshName}`);
        }
      }
    });

    console.log(`Loaded ${entries.length} structures (filtered out ${skippedByTypeOrName} by type/name/suffix)`);
    return entries;
  }, [scene, metadata]);

  // Mark loading complete
  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  // Calculate model bounds from FILTERED structures only
  const modelCenter = useMemo(() => {
    if (meshEntries.length === 0) {
      return new THREE.Vector3();
    }

    const box = new THREE.Box3();
    meshEntries.forEach(({ mesh }) => {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      box.union(meshBox);
    });

    const center = box.getCenter(new THREE.Vector3());
    return center;
  }, [meshEntries]);

  return (
    <group
      // Center the model
      position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}
      // Clear selection when clicking empty space
      onClick={(e) => {
        if (e.eventObject === e.object) {
          clearSelection();
        }
      }}
    >
      {meshEntries.map(({ mesh, metadata }) => (
        <StructureMesh
          key={metadata.meshId}
          mesh={mesh}
          metadata={metadata}
        />
      ))}
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/torso.glb');