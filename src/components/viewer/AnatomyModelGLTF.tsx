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
// STRUCTURE MESH COMPONENT
// ============================================================

interface StructureMeshProps {
  mesh: THREE.Mesh;
  metadata: StructureMetadata;
}

function StructureMesh({ mesh, metadata }: StructureMeshProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const {
    hoveredStructureId,
    selectedStructureId,
    setHoveredStructure,
    setSelectedStructure,
    layerVisibility,
  } = useAnatomyStore();

  const colors = TYPE_COLORS[metadata.type] || TYPE_COLORS.muscle;
  const isSelected = selectedStructureId === metadata.meshId;
  const isHighlighted = hovered || isSelected || hoveredStructureId === metadata.meshId;

  // Check visibility based on structure type
  const visibilityKey = TYPE_TO_VISIBILITY_KEY[metadata.type] || 'muscles';
  const isVisible = layerVisibility[visibilityKey];

  // Create material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: colors.default,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: metadata.type === 'bone' ? 1 : 0.9,
      side: THREE.DoubleSide,
    });
  }, [colors.default, metadata.type]);

  // Animate color on highlight
  useFrame(() => {
    if (materialRef.current) {
      const targetColor = isHighlighted ? colors.highlight : colors.default;
      materialRef.current.color.lerp(new THREE.Color(targetColor), 0.1);
    }
  });

  if (!isVisible) return null;

  return (
    <mesh
      geometry={mesh.geometry}
      position={mesh.position}
      rotation={mesh.rotation}
      scale={mesh.scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        setHoveredStructure(metadata.meshId);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        setHoveredStructure(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
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

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Try to find matching metadata
        const meshName = child.name;
        const structureData = metadata.structures[meshName];

        if (structureData) {
          entries.push({
            mesh: child,
            metadata: structureData,
          });
        } else {
          // Log unmatched meshes for debugging
          console.debug(`No metadata for mesh: ${meshName}`);
        }
      }
    });

    console.log(`Loaded ${entries.length} structures with metadata`);
    return entries;
  }, [scene, metadata]);

  // Mark loading complete
  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  // Calculate model bounds to center it
  const modelCenter = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    return center;
  }, [scene]);

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
