import { useMemo } from 'react';
import type { AnatomicalStructure, RenderConfig, StructureContent } from '@/types';

// ============================================================
// TYPES
// ============================================================

interface RawStructureMetadata {
  meshId: string;
  originalName: string;
  type: string;
  layer: number;
  regions: string[];
  center: [number, number, number];
}

interface RawMetadataFile {
  version: string;
  source: string;
  region: string;
  structures: Record<string, RawStructureMetadata>;
}

// ============================================================
// NAME GENERATION
// ============================================================

/**
 * Convert a mesh ID to a human-readable name.
 * Handles the Z-Anatomy naming conventions.
 */
function meshIdToDisplayName(meshId: string): { common: string; anatomical: string } {
  // Remove suffixes like _j, _i, _1, _ol, _or (Z-Anatomy conventions)
  let clean = meshId
    .replace(/_[jio]$/, '')
    .replace(/_\d+$/, '')
    .replace(/_ol$/, '')
    .replace(/_or$/, '');
  
  // Remove parentheses
  clean = clean.replace(/[()]/g, '');
  
  // Convert underscores to spaces and title case
  const words = clean.split('_').filter(Boolean);
  const titleCased = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // For now, use same name for both (can be enhanced with a lookup table)
  return {
    common: titleCased,
    anatomical: titleCased,
  };
}

// ============================================================
// CURATED NAMES (override automatic generation)
// ============================================================

const CURATED_NAMES: Record<string, { common: string; anatomical: string }> = {
  // Major muscles with fitness-friendly names
  'rectus_abdominis': { common: 'Six-Pack Muscle', anatomical: 'Rectus Abdominis' },
  'external_abdominal_oblique_muscle': { common: 'Side Abs (Outer)', anatomical: 'External Oblique' },
  'internal_abdominal_oblique_muscle': { common: 'Side Abs (Inner)', anatomical: 'Internal Oblique' },
  'transversus_abdominis_muscle': { common: 'Deep Core', anatomical: 'Transversus Abdominis' },
  'pectoralis_major_muscle': { common: 'Chest Muscle', anatomical: 'Pectoralis Major' },
  'pectoralis_minor_muscle': { common: 'Small Chest Muscle', anatomical: 'Pectoralis Minor' },
  'serratus_anterior_muscle': { common: "Boxer's Muscle", anatomical: 'Serratus Anterior' },
  'latissimus_dorsi_muscle': { common: 'Lats', anatomical: 'Latissimus Dorsi' },
  'erector_spinae': { common: 'Back Extensors', anatomical: 'Erector Spinae' },
  'trapezius_muscle': { common: 'Traps', anatomical: 'Trapezius' },
  'diaphragm': { common: 'Breathing Muscle', anatomical: 'Diaphragm' },
  'psoas_major_muscle': { common: 'Hip Flexor', anatomical: 'Psoas Major' },
  'iliacus_muscle': { common: 'Hip Muscle', anatomical: 'Iliacus' },
  'quadratus_lumborum_muscle': { common: 'QL Muscle', anatomical: 'Quadratus Lumborum' },
  'gluteus_maximus_muscle': { common: 'Glutes', anatomical: 'Gluteus Maximus' },
  'gluteus_medius_muscle': { common: 'Side Glute', anatomical: 'Gluteus Medius' },
  'gluteus_minimus_muscle': { common: 'Deep Glute', anatomical: 'Gluteus Minimus' },
  
  // Bones
  'sternum': { common: 'Breastbone', anatomical: 'Sternum' },
  'xiphoid_process': { common: 'Lower Breastbone', anatomical: 'Xiphoid Process' },
  'sacrum': { common: 'Tailbone Base', anatomical: 'Sacrum' },
  'coccyx': { common: 'Tailbone', anatomical: 'Coccyx' },
  'ilium': { common: 'Hip Wing', anatomical: 'Ilium' },
  'ischium': { common: 'Sit Bone', anatomical: 'Ischium' },
  'pubis': { common: 'Pubic Bone', anatomical: 'Pubis' },
  
  // Vertebrae
  'vertebra_t1': { common: 'T1 Vertebra', anatomical: 'First Thoracic Vertebra' },
  'vertebra_t12': { common: 'T12 Vertebra', anatomical: 'Twelfth Thoracic Vertebra' },
  'vertebra_l1': { common: 'L1 Vertebra', anatomical: 'First Lumbar Vertebra' },
  'vertebra_l5': { common: 'L5 Vertebra', anatomical: 'Fifth Lumbar Vertebra' },
  
  // Ribs
  'rib_1': { common: 'First Rib', anatomical: 'First Rib' },
  'rib_12': { common: 'Floating Rib', anatomical: 'Twelfth Rib' },
  
  // Organs
  'liver': { common: 'Liver', anatomical: 'Liver' },
  'stomach': { common: 'Stomach', anatomical: 'Stomach' },
  'spleen': { common: 'Spleen', anatomical: 'Spleen' },
  'kidneys': { common: 'Kidneys', anatomical: 'Kidneys' },
  'heart': { common: 'Heart', anatomical: 'Heart' },
  'lungs': { common: 'Lungs', anatomical: 'Lungs' },
};

/**
 * Get display names for a structure, using curated names when available.
 */
function getDisplayNames(meshId: string): { common: string; anatomical: string } {
  // Check for exact match in curated names
  if (CURATED_NAMES[meshId]) {
    return CURATED_NAMES[meshId];
  }
  
  // Check for partial match (without suffix)
  const baseName = meshId.replace(/_[jio]$/, '').replace(/_\d+$/, '');
  if (CURATED_NAMES[baseName]) {
    return CURATED_NAMES[baseName];
  }
  
  // Fall back to automatic generation
  return meshIdToDisplayName(meshId);
}

// ============================================================
// COLOR PALETTE
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

// ============================================================
// MAIN HOOK
// ============================================================

/**
 * Hook to load and transform anatomy metadata into app-friendly format.
 */
export function useAnatomyData(rawMetadata: RawMetadataFile) {
  return useMemo(() => {
    const structures: AnatomicalStructure[] = [];
    const renderConfigs: Record<string, RenderConfig> = {};
    const contentMap: Record<string, StructureContent> = {};

    for (const [id, raw] of Object.entries(rawMetadata.structures)) {
      const names = getDisplayNames(id);
      const colors = TYPE_COLORS[raw.type] || TYPE_COLORS.muscle;
      
      // Create structure
      const structure: AnatomicalStructure = {
        id: raw.meshId,
        meshId: raw.meshId,
        commonName: names.common,
        anatomicalName: names.anatomical,
        type: raw.type as AnatomicalStructure['type'],
        layer: raw.layer,
        systems: raw.type === 'bone' ? ['skeletal'] : 
                 raw.type === 'organ' ? ['digestive'] : ['muscular'],
        regions: raw.regions as AnatomicalStructure['regions'],
      };
      structures.push(structure);

      // Create render config
      const opacity = raw.type === 'bone' ? 1 : 
                      raw.layer === 1 ? 0.75 :
                      raw.layer === 2 ? 0.85 : 0.9;
      
      renderConfigs[raw.meshId] = {
        structureId: raw.meshId,
        defaultColor: colors.default,
        highlightColor: colors.highlight,
        opacity,
        visibleAtZoomLevel: raw.layer <= 1 ? 0.5 : raw.layer === 2 ? 0.3 : 0,
        labelAnchorOffset: [raw.center[0] * 0.1, raw.center[1] * 0.1, raw.center[2] * 0.1],
      };

      // Create basic content (can be enhanced with detailed descriptions)
      contentMap[raw.meshId] = {
        structureId: raw.meshId,
        simpleDescription: `The ${names.common.toLowerCase()} is part of the ${raw.regions.join(' and ')}.`,
        clinicalDescription: `${names.anatomical} - a ${raw.type} structure located in the ${raw.regions.join(', ')}.`,
        relatedStructures: [], // Could be computed based on region overlap
      };
    }

    return {
      structures,
      renderConfigs,
      contentMap,
      
      // Lookup helpers
      getStructureById: (id: string) => structures.find(s => s.id === id),
      getStructuresByRegion: (region: string) => structures.filter(s => s.regions.includes(region as any)),
      getStructuresByType: (type: string) => structures.filter(s => s.type === type),
      getRenderConfig: (id: string) => renderConfigs[id],
      getContent: (id: string) => contentMap[id],
    };
  }, [rawMetadata]);
}

// ============================================================
// STATS HELPER
// ============================================================

export function getMetadataStats(metadata: RawMetadataFile) {
  const structures = Object.values(metadata.structures);
  
  const byType: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  
  for (const s of structures) {
    byType[s.type] = (byType[s.type] || 0) + 1;
    for (const r of s.regions) {
      byRegion[r] = (byRegion[r] || 0) + 1;
    }
  }
  
  return {
    total: structures.length,
    byType,
    byRegion,
  };
}
