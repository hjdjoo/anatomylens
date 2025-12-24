import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnatomyStore } from '@/store';
import type { LayerVisibility } from '@/types';

// Import the metadata
import torsoMetadata from '@/data/torso_metadata.json';

// ============================================================
// DEBUG CONFIGURATION
// ============================================================

const DEBUG_ENABLED = false;  // Disabled for production
const DEBUG_STRUCTURES = ['Inguinal'];

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
  type: 'bone' | 'muscle' | 'organ' | 'tendon' | 'ligament' | 'cartilage' | 'fascia' | 'other';
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

interface ProcessedStructure {
  uniqueKey: string;           // Unique key for React (glTF mesh name)
  mesh: THREE.Mesh;
  metadata: StructureMetadata;
  center: THREE.Vector3;       // From metadata (trusted from V7 export)
}

// ============================================================
// CONSTANTS
// ============================================================

const TYPE_COLORS: Record<string, { default: string; highlight: string }> = {
  bone: { default: '#E8DCC4', highlight: '#FFF8E7' },
  muscle: { default: '#C41E3A', highlight: '#FF4D6A' },
  organ: { default: '#8B4557', highlight: '#A85A6F' },
  tendon: { default: '#D4A574', highlight: '#E8C9A0' },
  ligament: { default: '#8B7355', highlight: '#A89070' },
  cartilage: { default: '#A8D5BA', highlight: '#C5E8D2' },
  fascia: { default: '#D4A5A5', highlight: '#E8C5C5' },
};

const TYPE_TO_VISIBILITY_KEY: Record<string, keyof LayerVisibility> = {
  bone: 'bones',
  muscle: 'muscles',
  organ: 'organs',
  tendon: 'tendons',
  ligament: 'ligaments',
  cartilage: 'bones',
  fascia: 'muscles',
};

// ============================================================
// GLTF NAME NORMALIZATION & MATCHING
// ============================================================

/**
 * Normalize a glTF mesh name to get the base name (without side or numeric suffixes).
 * 
 * glTF exporter adds suffixes like '001', '002', '001_1', '002_1' to mesh names.
 * Examples:
 *   - '(Abdominal_part_of_pectoralis_major_muscle)001' -> '(abdominal_part_of_pectoralis_major_muscle)'
 *   - '(Abdominal_part_of_pectoralis_major_muscle)001_1' -> '(abdominal_part_of_pectoralis_major_muscle)'
 *   - 'Clavicular_head_of_pectoralis_major_muscle002_1' -> 'clavicular_head_of_pectoralis_major_muscle'
 */
function normalizeGltfNameToBase(gltfName: string): string {
  return gltfName
    .replace(/00\d+(_\d+)?/g, '')  // Remove Blender's numeric suffixes (001, 001_1, 002, 002_1, etc.)
    .toLowerCase()
    .replace(/[(\()(\))]/g, '')  // Remove parentheses
    .replace(/_[lr]$/i, '')        // Remove any existing _l or _r suffix
    .replace(/__+/g, '_')          // Clean up double underscores
    .replace(/_+$/, '');           // Remove trailing underscores
}

/**
 * Build a lookup map from base names to their _l/_r variants in metadata.
 * This enables O(1) matching for bilateral structures.
 */
function buildSideLookupMap(
  structures: Record<string, StructureMetadata>
): Map<string, { left?: string; right?: string; single?: string }> {
  const lookup = new Map<string, { left?: string; right?: string; single?: string }>();

  for (const key of Object.keys(structures)) {
    let baseName: string;
    let side: 'left' | 'right' | 'single';

    if (key.endsWith('_l')) {
      baseName = key.slice(0, -2);
      side = 'left';
    } else if (key.endsWith('_r')) {
      baseName = key.slice(0, -2);
      side = 'right';
    } else if (key.endsWith('_i')) {
      // _i suffix typically means "left" in Z-Anatomy joint notation
      baseName = key.slice(0, -2);
      side = 'left';
    } else if (key.endsWith('_j')) {
      // _j suffix - could be joint or right side, treat as single to avoid collision
      baseName = key.slice(0, -2);
      side = 'single';
    } else {
      baseName = key;
      side = 'single';
    }

    const existing = lookup.get(baseName) || {};
    if (side === 'left') {
      existing.left = key;
    } else if (side === 'right') {
      existing.right = key;
    } else {
      existing.single = key;
    }
    lookup.set(baseName, existing);
  }

  return lookup;
}

/**
 * Determine which side (left/right) a mesh is on based on its world position.
 * In anatomical convention: positive X = left side, negative X = right side
 */
function determineSideFromPosition(mesh: THREE.Mesh): 'left' | 'right' | 'center' {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());

  const threshold = 0.02;
  if (Math.abs(center.x) < threshold) {
    return 'center';
  }
  return center.x > 0 ? 'left' : 'right';
}

/**
 * Find metadata for a glTF mesh using smart matching.
 * 
 * Strategy:
 * 1. Try exact match
 * 2. Try direct normalized match (for single structures)
 * 3. For bilateral structures, use position to determine _l/_r variant
 */
function findMetadataForMesh(
  mesh: THREE.Mesh,
  structures: Record<string, StructureMetadata>,
  sideLookup: Map<string, { left?: string; right?: string; single?: string }>
): { key: string; data: StructureMetadata } | null {
  const gltfName = mesh.name;

  // Try exact match first
  if (structures[gltfName]) {
    return { key: gltfName, data: structures[gltfName] };
  }

  // Try exact match with lowercase
  const lowered = gltfName.toLowerCase();
  if (structures[lowered]) {
    return { key: lowered, data: structures[lowered] };
  }

  // Get the base name (without numeric suffixes or side markers)
  const baseName = normalizeGltfNameToBase(gltfName);

  // Look up in side map
  const sideVariants = sideLookup.get(baseName);
  if (!sideVariants) {
    return null;
  }

  // If there's only a single (non-sided) version, use it
  if (sideVariants.single && !sideVariants.left && !sideVariants.right) {
    return { key: sideVariants.single, data: structures[sideVariants.single] };
  }

  // If there are sided versions, determine which one based on position
  if (sideVariants.left || sideVariants.right) {
    const side = determineSideFromPosition(mesh);

    if (side === 'left' && sideVariants.left) {
      return { key: sideVariants.left, data: structures[sideVariants.left] };
    }
    if (side === 'right' && sideVariants.right) {
      return { key: sideVariants.right, data: structures[sideVariants.right] };
    }
    // Fallback: if center or missing side variant, try any available
    if (sideVariants.left) {
      return { key: sideVariants.left, data: structures[sideVariants.left] };
    }
    if (sideVariants.right) {
      return { key: sideVariants.right, data: structures[sideVariants.right] };
    }
  }

  // Final fallback: try single
  if (sideVariants.single) {
    return { key: sideVariants.single, data: structures[sideVariants.single] };
  }

  return null;
}

// ============================================================
// STRUCTURE FILTERING
// ============================================================

const EXCLUDE_NAME_PATTERNS = [
  'plane', 'planes', 'flexion', 'extension', 'rotation', 'abduction',
  'adduction', 'pronation', 'supination', 'circumduction',
  'lateral_rectus_muscle', 'medial_rectus_muscle', 'superior_rectus_muscle',
  'inferior_rectus_muscle', 'superior_oblique_muscle', 'inferior_oblique_muscle',
  'pronator_quadratus', 'pronator_teres', 'supinator', 'oblique_cord',
  'plantae', 'popliteal', 'femoris', 'tibial', 'fibular', 'peroneal',
  'gastrocnemius', 'soleus', 'plantaris', 'lymph_node',
];

const EXCLUDE_SUFFIX_PATTERNS = [
  /_j$/i,
  /_i$/i,
  /_o\d*[lr]$/i,
  /_e\d+[lr]$/i,
  /_el$/i,
  /_er$/i,
];

const EXCLUDE_TYPES = ['organ', 'other'];

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
// MESH PROCESSING (OPTIMIZED - NO CLONING)
// ============================================================

/**
 * Check if a matrix is effectively identity (transforms already baked into vertices).
 * V10.5 export applies transforms before export, so matrixWorld should be identity.
 */
function isIdentityMatrix(matrix: THREE.Matrix4, tolerance = 0.0001): boolean {
  const elements = matrix.elements;
  // Identity matrix: diagonal = 1, off-diagonal = 0
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let i = 0; i < 16; i++) {
    if (Math.abs(elements[i] - identity[i]) > tolerance) {
      return false;
    }
  }
  return true;
}

// Track if we've logged the transform status (once per session)
let hasLoggedTransformStatus = false;

/**
 * Process a mesh from the glTF scene.
 * 
 * OPTIMIZATION: V10.5 export bakes transforms into vertices, so matrixWorld
 * should be identity. We use the original geometry directly instead of cloning,
 * reducing memory usage by ~50%.
 * 
 * Center comes from metadata (trusted from V10.5 export).
 */
function processGLTFMesh(
  child: THREE.Mesh,
  metadata: StructureMetadata,
  uniqueKey: string
): ProcessedStructure {
  debugLog(child.name, 'Processing mesh');

  const hasIdentityTransform = isIdentityMatrix(child.matrixWorld);

  // Log transform status once to help diagnose issues
  if (!hasLoggedTransformStatus && DEBUG_ENABLED) {
    hasLoggedTransformStatus = true;
    if (hasIdentityTransform) {
      console.log('[MEMORY] ✓ Transforms are baked - using geometry directly (no cloning)');
    } else {
      console.log('[MEMORY] ⚠ Transforms not baked - falling back to cloning');
      console.log('  First mesh matrixWorld:', child.matrixWorld.elements);
    }
  }

  let geometry: THREE.BufferGeometry;

  if (hasIdentityTransform) {
    // OPTIMIZED PATH: Use geometry directly (no clone needed)
    // This saves ~100MB by avoiding geometry duplication
    geometry = child.geometry;
  } else {
    // FALLBACK PATH: Clone and bake transform (legacy behavior)
    // This shouldn't happen with V10.5 exports
    geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
  }

  // Use center from metadata (V10.5 export computed this correctly)
  const center = new THREE.Vector3(...metadata.center);

  debugLog(child.name, 'Center from metadata:', metadata.center);

  return {
    uniqueKey,
    mesh: new THREE.Mesh(geometry),  // Lightweight - just references existing geometry
    metadata,
    center,
  };
}

// ============================================================
// STRUCTURE MESH COMPONENT
// ============================================================

interface StructureMeshProps {
  structure: ProcessedStructure;
}

function StructureMesh({ structure }: StructureMeshProps) {
  const { mesh, metadata, center } = structure;
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const animatedOpacity = useRef(1);
  const lastClickTime = useRef(0);

  const {
    hoveredStructureId,
    selectedStructureId,
    setHoveredStructure,
    setSelectedStructure,
    layerVisibility,
    peelDepth,
    searchQuery,
    manuallyPeeledIds,
    toggleManualPeel,
  } = useAnatomyStore();

  const colors = TYPE_COLORS[metadata.type] || TYPE_COLORS.muscle;
  const isSelected = selectedStructureId === metadata.meshId;
  const isManuallyPeeled = manuallyPeeledIds.has(metadata.meshId);

  const matchesSearch = searchQuery.length > 1 && (
    metadata.meshId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    metadata.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isHighlighted = hovered || isSelected || hoveredStructureId === metadata.meshId || matchesSearch;

  const visibilityKey = TYPE_TO_VISIBILITY_KEY[metadata.type] || 'muscles';
  const isTypeVisible = layerVisibility[visibilityKey];

  // Layer-based peeling (global slider)
  const maxVisibleLayer = 3 - peelDepth;
  const isLayerPeeled = metadata.layer > maxVisibleLayer;

  // Combined peeling: either layer-peeled OR manually peeled (but not if search matches)
  const shouldPeel = (isLayerPeeled || isManuallyPeeled) && !matchesSearch;
  const targetOpacity = shouldPeel ? 0 : (metadata.type === 'bone' ? 1 : 0.9);

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

  useFrame(() => {
    if (!materialRef.current) return;

    let targetColor = colors.default;
    if (matchesSearch) {
      targetColor = '#FFD700';
    } else if (isHighlighted && !shouldPeel) {
      targetColor = colors.highlight;
    }
    materialRef.current.color.lerp(new THREE.Color(targetColor), 0.1);

    animatedOpacity.current += (targetOpacity - animatedOpacity.current) * 0.08;
    materialRef.current.opacity = animatedOpacity.current;
    materialRef.current.depthWrite = animatedOpacity.current > 0.5;
  });

  if (!isTypeVisible) return null;

  // Base interactivity on render-time state, not animated opacity
  // This ensures raycast updates immediately when peelDepth changes
  const isInteractive = !shouldPeel;

  // Handle click with double-click detection for peeling
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!isInteractive) return;
    e.stopPropagation();

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime.current;
    lastClickTime.current = now;

    // Double-click threshold: 300ms
    if (timeSinceLastClick < 300) {
      // Double-click: toggle manual peel
      toggleManualPeel(metadata.meshId);
      // Clear selection since structure is being peeled away
      setSelectedStructure(null);
    } else {
      // Single click: toggle selection
      setSelectedStructure(isSelected ? null : metadata.meshId);
    }
  }, [isInteractive, isSelected, metadata.meshId, setSelectedStructure, toggleManualPeel]);

  useEffect(() => {
    if (isSelected) {
      debugLog(metadata.meshId, 'SELECTED - Center:', center.toArray());
    }
  }, [isSelected, metadata.meshId, center]);

  return (
    <mesh
      ref={meshRef}
      geometry={mesh.geometry}
      // Note: We don't manipulate raycast prop directly as it can break Three.js internals.
      // Instead, we rely on early returns in event handlers for non-interactive states.
      // Performance impact is negligible since handlers exit immediately.
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
      onClick={handleClick}
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

  const metadata = JSON.parse(JSON.stringify(torsoMetadata)) as MetadataFile;

  const processedStructures = useMemo(() => {
    const structures: ProcessedStructure[] = [];
    const usedMetadataKeys = new Set<string>();  // Track which metadata entries have been used
    let skippedByTypeOrName = 0;
    let skippedDuplicate = 0;
    let unmatchedCount = 0;

    // Build side lookup map for efficient bilateral structure matching
    const sideLookup = buildSideLookupMap(metadata.structures);

    // Update world matrices for the entire scene hierarchy
    scene.updateMatrixWorld(true);

    if (DEBUG_ENABLED) {
      console.log('='.repeat(60));
      console.log('[DEBUG] Processing anatomy model...');
      console.log(`[DEBUG] Side lookup map has ${sideLookup.size} base names`);
      console.log('='.repeat(60));
    }

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const gltfMeshName = child.name;

        // Find matching metadata using smart position-based matching
        const match = findMetadataForMesh(child, metadata.structures, sideLookup);

        if (!match) {
          console.log(`No match for mesh name: ${gltfMeshName}`)
          unmatchedCount++;
          return;
        }

        // Skip if we've already used this metadata entry (prevents duplicates)
        if (usedMetadataKeys.has(match.key)) {
          skippedDuplicate++;
          // Only log if debug enabled to reduce console noise
          if (DEBUG_ENABLED) {
            console.log(`Skipping duplicate for metadata key: ${match.key}`);
          }
          return;
        }

        const structureData = match.data;

        // Filter by type and name patterns
        if (!shouldRenderByTypeAndName(structureData)) {
          skippedByTypeOrName++;
          return;
        }

        // Mark this metadata key as used
        usedMetadataKeys.add(match.key);

        // Process the mesh - use gltfMeshName as unique key to avoid React key conflicts
        const processed = processGLTFMesh(child, structureData, gltfMeshName);
        structures.push(processed);
      }
    });

    console.log(`Loaded ${structures.length} structures`);
    console.log(`  Skipped: ${skippedByTypeOrName} (filtered), ${skippedDuplicate} (duplicate), ${unmatchedCount} (no metadata)`);

    return structures;
  }, [scene, metadata]);

  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  // Calculate model bounds from all structures
  const modelCenter = useMemo(() => {
    if (processedStructures.length === 0) {
      return new THREE.Vector3();
    }

    const box = new THREE.Box3();
    processedStructures.forEach(({ mesh }) => {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      box.union(meshBox);
    });

    return box.getCenter(new THREE.Vector3());
  }, [processedStructures]);

  return (
    <group
      position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}
      onClick={(e) => {
        if (e.eventObject === e.object) {
          clearSelection();
        }
      }}
    >
      {processedStructures.map((structure) => (
        <StructureMesh
          key={structure.uniqueKey}  // Use unique glTF mesh name, not metadata meshId
          structure={structure}
        />
      ))}
    </group>
  );
}

useGLTF.preload('/models/torso.glb');