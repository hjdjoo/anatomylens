import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnatomyStore } from '@/store';
import type { LayerVisibility } from '@/types';

// Import the metadata
import torsoMetadata from '@/data/torso_metadata.json';

// ============================================================
// DEBUG CONFIGURATION
// ============================================================

// Set to true to enable debugging output for specific structures
const DEBUG_ENABLED = true;
const DEBUG_STRUCTURES = ['inguinal_ligament', 'inguinal_ligament_1'];

function debugLog(meshName: string, message: string, data?: unknown) {
  if (!DEBUG_ENABLED) return;
  if (!DEBUG_STRUCTURES.some(s => meshName.toLowerCase().includes(s.toLowerCase()))) return;

  console.log(`[DEBUG ${meshName}] ${message}`, data ?? '');
}

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

// Extended metadata with computed center
interface ProcessedStructure {
  mesh: THREE.Mesh;
  metadata: StructureMetadata;
  computedCenter: THREE.Vector3; // Computed from actual geometry
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

// Z-Anatomy suffix patterns to exclude
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
 */
function shouldRenderByTypeAndName(metadata: StructureMetadata): boolean {
  if (EXCLUDE_TYPES.includes(metadata.type)) {
    return false;
  }

  const nameLower = metadata.meshId.toLowerCase();

  if (EXCLUDE_NAME_PATTERNS.some(pattern => nameLower.includes(pattern))) {
    return false;
  }

  if (EXCLUDE_SUFFIX_PATTERNS.some(pattern => pattern.test(metadata.meshId))) {
    return false;
  }

  return true;
}

// ============================================================
// CENTER COMPUTATION - CLEAN IMPLEMENTATION
// ============================================================

/**
 * Compute the world-space center of a mesh's geometry.
 * 
 * This is the SINGLE SOURCE OF TRUTH for mesh centers.
 * It computes the center from the actual vertex data after applying
 * all world transforms, making it immune to:
 * - Parent-child hierarchy issues in glTF
 * - Coordinate system mismatches between Blender and Three.js
 * - Metadata errors from the export process
 * 
 * @param geometry - The mesh geometry
 * @param worldMatrix - The world transform matrix to apply
 * @returns The center point in world coordinates
 */
function computeGeometryCenter(
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4
): THREE.Vector3 {
  // Clone geometry so we don't mutate the original
  const tempGeometry = geometry.clone();

  // Apply world transform to get vertices in world space
  tempGeometry.applyMatrix4(worldMatrix);

  // Compute bounding box from transformed vertices
  tempGeometry.computeBoundingBox();

  if (!tempGeometry.boundingBox) {
    console.warn('Could not compute bounding box for geometry');
    return new THREE.Vector3();
  }

  // Get center of bounding box
  const center = new THREE.Vector3();
  tempGeometry.boundingBox.getCenter(center);

  // Clean up
  tempGeometry.dispose();

  return center;
}

/**
 * Process a mesh from the glTF scene:
 * 1. Clone geometry
 * 2. Apply world transforms to vertex data
 * 3. Compute center from transformed geometry
 * 
 * This ensures the mesh renders correctly at origin with all transforms baked in,
 * and we have an accurate center for UI/camera purposes.
 */
function processGLTFMesh(
  child: THREE.Mesh,
  metadata: StructureMetadata
): ProcessedStructure {
  debugLog(child.name, 'Processing mesh');
  debugLog(child.name, 'Local position:', child.position.toArray());
  debugLog(child.name, 'World matrix:', child.matrixWorld.toArray());

  // Step 1: Compute center BEFORE cloning/transforming
  // We need the world matrix to transform the geometry center
  const computedCenter = computeGeometryCenter(child.geometry, child.matrixWorld);

  debugLog(child.name, 'Metadata center:', metadata.center);
  debugLog(child.name, 'Computed center:', computedCenter.toArray());

  // Check for significant mismatch
  const metadataVec = new THREE.Vector3(...metadata.center);
  const distance = computedCenter.distanceTo(metadataVec);
  if (distance > 0.05) { // More than 5cm difference
    debugLog(child.name, `⚠️ CENTER MISMATCH: ${distance.toFixed(4)} units difference`);
  }

  // Step 2: Clone geometry and bake world transform into vertices
  const clonedGeometry = child.geometry.clone();
  clonedGeometry.applyMatrix4(child.matrixWorld);

  // Step 3: Create new mesh at origin (transform is baked into vertices)
  const newMesh = new THREE.Mesh(clonedGeometry);
  newMesh.name = child.name;

  debugLog(child.name, 'Processing complete ✓');

  return {
    mesh: newMesh,
    metadata,
    computedCenter,
  };
}

// ============================================================
// STRUCTURE MESH COMPONENT
// ============================================================

interface StructureMeshProps {
  structure: ProcessedStructure;
}

function StructureMesh({ structure }: StructureMeshProps) {
  const { mesh, metadata, computedCenter } = structure;
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

  // Debug: Log when selected
  useEffect(() => {
    if (isSelected) {
      debugLog(metadata.meshId, 'SELECTED - Center info:', {
        metadataCenter: metadata.center,
        computedCenter: computedCenter.toArray(),
      });
    }
  }, [isSelected, metadata.meshId, metadata.center, computedCenter]);

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

  // Extract meshes, apply transforms, and compute centers
  const processedStructures = useMemo(() => {
    const structures: ProcessedStructure[] = [];
    let skippedByTypeOrName = 0;

    // CRITICAL: Update world matrices for the entire scene hierarchy
    // This ensures child meshes have correct matrixWorld values
    scene.updateMatrixWorld(true);

    if (DEBUG_ENABLED) {
      console.log('='.repeat(60));
      console.log('[DEBUG] Processing anatomy model...');
      console.log('='.repeat(60));
    }

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const meshName = child.name;
        const structureData = metadata.structures[meshName];

        if (structureData) {
          // Filter by type, name patterns, and suffix patterns
          if (!shouldRenderByTypeAndName(structureData)) {
            skippedByTypeOrName++;
            return;
          }

          // Process the mesh and compute center
          const processed = processGLTFMesh(child, structureData);
          structures.push(processed);
        } else {
          // Log unmatched meshes for debugging
          console.debug(`No metadata for mesh: ${meshName}`);
        }
      }
    });

    console.log(`Loaded ${structures.length} structures (filtered out ${skippedByTypeOrName} by type/name/suffix)`);

    if (DEBUG_ENABLED) {
      console.log('='.repeat(60));
      console.log('[DEBUG] Processing complete');
      console.log('='.repeat(60));
    }

    return structures;
  }, [scene, metadata]);

  // Mark loading complete
  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  // Calculate model bounds from FILTERED structures only
  // Uses computed centers for accuracy
  const modelCenter = useMemo(() => {
    if (processedStructures.length === 0) {
      return new THREE.Vector3();
    }

    const box = new THREE.Box3();
    processedStructures.forEach(({ mesh }) => {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      box.union(meshBox);
    });

    const center = box.getCenter(new THREE.Vector3());
    return center;
  }, [processedStructures]);

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
      {processedStructures.map((structure) => (
        <StructureMesh
          key={structure.metadata.meshId}
          structure={structure}
        />
      ))}
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/torso.glb');