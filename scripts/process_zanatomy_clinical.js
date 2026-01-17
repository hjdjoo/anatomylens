/**
 * Z-Anatomy Clinical Data Processor
 * 
 * Processes the extracted Z-Anatomy descriptions and maps them
 * to your body_registry structures, outputting seed data for
 * the structure_clinical table.
 * 
 * Usage: node process_zanatomy_clinical.js
 * 
 * Input files (in src/data/):
 *   - zanatomy_descriptions.json (from Blender export)
 *   - body_registry.json (your structure registry)
 * 
 * Output files (in src/data/):
 *   - structure_clinical_seed.json (for seeding Supabase)
 *   - clinical_mapping_report.json (debug/review report)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve('src', 'data');

// ============================================================
// CONFIGURATION
// ============================================================

const INPUT_FILES = {
  descriptions: path.join(DATA_DIR, 'zanatomy_descriptions.json'),
  registry: path.join(DATA_DIR, 'body_registry.json'),
};

const OUTPUT_FILES = {
  clinicalSeed: path.join(DATA_DIR, 'structure_clinical_seed.json'),
  report: path.join(DATA_DIR, 'clinical_mapping_report.json'),
};

// ============================================================
// TEXT EXTRACTION PATTERNS
// ============================================================

const EXTRACTION_PATTERNS = {
  // Origin patterns
  origin: [
    /origin[:\s]+([^.]+(?:\.[^A-Z])?[^.]*\.)/i,
    /originates?\s+(?:from|at|on)\s+([^.]+\.)/i,
    /arises?\s+(?:from|at)\s+([^.]+\.)/i,
    /proximal\s+attachment[:\s]+([^.]+\.)/i,
  ],
  
  // Insertion patterns  
  insertion: [
    /insertion[:\s]+([^.]+(?:\.[^A-Z])?[^.]*\.)/i,
    /inserts?\s+(?:into|on|at|to)\s+([^.]+\.)/i,
    /attaches?\s+(?:to|at)\s+([^.]+\.)/i,
    /distal\s+attachment[:\s]+([^.]+\.)/i,
  ],
  
  // Innervation patterns
  innervation: [
    /innervation[:\s]+([^.]+\.)/i,
    /innervated\s+by\s+([^.]+\.)/i,
    /nerve\s+supply[:\s]+([^.]+\.)/i,
    /(?:the\s+)?(\w+(?:\s+\w+)*\s+nerve)\s+(?:innervates|supplies)/i,
  ],
  
  // Blood supply patterns
  bloodSupply: [
    /blood\s+supply[:\s]+([^.]+\.)/i,
    /(?:arterial|vascular)\s+supply[:\s]+([^.]+\.)/i,
    /supplied\s+by\s+(?:the\s+)?([^.]+artery[^.]*\.)/i,
  ],
  
  // Action/function patterns
  action: [
    /action[:\s]+([^.]+\.)/i,
    /function[:\s]+([^.]+\.)/i,
    /it\s+((?:flexes|extends|abducts|adducts|rotates|elevates|depresses|protracts|retracts)[^.]+\.)/i,
  ],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize a structure name for matching
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/^\(/, '')  // Remove leading paren
    .replace(/\)$/, '')  // Remove trailing paren
    .replace(/\.(l|r|g|j|i|t|s)$/i, '')  // Remove suffixes
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate matching variations for a structure name
 */
function generateNameVariations(name) {
  const base = normalizeName(name);
  const variations = new Set([base]);
  
  // Add with/without "muscle" suffix
  if (base.endsWith(' muscle')) {
    variations.add(base.replace(' muscle', ''));
  } else if (!base.includes('muscle')) {
    variations.add(base + ' muscle');
  }
  
  // Add with/without "bone" suffix
  if (base.endsWith(' bone')) {
    variations.add(base.replace(' bone', ''));
  }
  
  // Add with parentheses (Z-Anatomy style for variations)
  variations.add(`(${base})`);
  
  // Handle bilateral structures - try without side indicators
  const withoutSide = base
    .replace(/\s*(left|right)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutSide !== base) {
    variations.add(withoutSide);
  }
  
  // Handle "X of Y" patterns - Z-Anatomy might have just "X"
  // e.g., "long head of biceps brachii" -> also try "biceps brachii"
  const ofMatch = base.match(/^(.+)\s+of\s+(.+)$/);
  if (ofMatch) {
    variations.add(ofMatch[2]); // The main structure
    variations.add(`${ofMatch[1]} ${ofMatch[2]}`); // Without "of"
  }
  
  // Handle "X part of Y" patterns
  const partMatch = base.match(/^(.+)\s+part\s+of\s+(.+)$/);
  if (partMatch) {
    variations.add(partMatch[2]); // The main structure
  }
  
  // Handle structures with "head" - try the full muscle name
  // e.g., "lateral head of triceps brachii" -> "triceps brachii"
  const headMatch = base.match(/^(lateral|medial|long|short)\s+head\s+of\s+(.+)$/);
  if (headMatch) {
    variations.add(headMatch[2]);
  }
  
  return Array.from(variations);
}

/**
 * Extract a field from description text using patterns
 */
function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract common injuries from description (heuristic)
 */
function extractCommonInjuries(text) {
  const injuries = [];
  const lowerText = text.toLowerCase();
  
  const injuryKeywords = [
    'tear', 'rupture', 'strain', 'sprain', 'fracture',
    'tendinitis', 'tendinopathy', 'bursitis', 'impingement',
    'dislocation', 'subluxation', 'avulsion'
  ];
  
  // Look for sentences containing injury keywords
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const keyword of injuryKeywords) {
      if (lower.includes(keyword)) {
        const cleaned = sentence.trim();
        if (cleaned.length > 10 && cleaned.length < 200) {
          injuries.push(cleaned);
        }
        break;
      }
    }
  }
  
  return injuries.slice(0, 5); // Max 5 injuries
}

/**
 * Clean and format the clinical description
 */
function cleanDescription(text) {
  return text
    .replace(/^\([^)]+\)\s*/i, '')  // Remove title in parens
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// MAIN PROCESSING
// ============================================================

function loadFiles() {
  console.log('Loading input files...');
  
  const descriptions = JSON.parse(
    fs.readFileSync(INPUT_FILES.descriptions, 'utf-8')
  );
  
  const registry = JSON.parse(
    fs.readFileSync(INPUT_FILES.registry, 'utf-8')
  );
  
  console.log(`  Descriptions: ${Object.keys(descriptions).length}`);
  
  // Count structures in registry
  let structureCount = 0;
  const allStructures = [];
  
  for (const [region, data] of Object.entries(registry)) {
    if (region.startsWith('_')) continue;
    if (data.structures && Array.isArray(data.structures)) {
      structureCount += data.structures.length;
      for (const s of data.structures) {
        allStructures.push({ name: s, region });
      }
    }
  }
  
  console.log(`  Registry structures: ${structureCount}`);
  
  return { descriptions, registry, allStructures };
}

function buildDescriptionIndex(descriptions) {
  console.log('\nBuilding description index...');
  
  const index = new Map();
  
  for (const [name, content] of Object.entries(descriptions)) {
    const normalized = normalizeName(name);
    index.set(normalized, { originalName: name, content });
    
    // Also index without parentheses prefix
    const withoutParens = normalized.replace(/^\(/, '').replace(/\)$/, '');
    if (withoutParens !== normalized) {
      index.set(withoutParens, { originalName: name, content });
    }
  }
  
  console.log(`  Index entries: ${index.size}`);
  return index;
}

function matchStructureToDescription(structureName, descriptionIndex) {
  const variations = generateNameVariations(structureName);
  
  // Try exact matches first
  for (const variation of variations) {
    if (descriptionIndex.has(variation)) {
      return descriptionIndex.get(variation);
    }
  }
  
  const normalized = normalizeName(structureName);
  const normalizedWords = normalized.split(/[\s_]+/);
  
  // Try matching with common anatomical naming variations
  // e.g., "Long head of biceps brachii" should match "Biceps brachii" description
  // but "Ethmoid bone" should NOT match generic "Bone"
  
  for (const [key, value] of descriptionIndex.entries()) {
    const keyWords = key.split(/[\s_]+/);
    
    // Skip generic single-word entries like "bone", "muscle", "nerve"
    if (keyWords.length === 1 && keyWords[0].length < 10) {
      continue;
    }
    
    // Skip if the description key is much shorter than our structure name
    // (avoids matching "bone" to "middle_cells_of_ethmoid_bone")
    if (key.length < normalized.length * 0.5) {
      continue;
    }
    
    // Check if the structure name STARTS with the description key
    // e.g., "long head of biceps brachii" starts with "biceps brachii" - NO
    // This is too loose, let's be stricter
    
    // Check if the description key STARTS with significant part of structure name
    // e.g., description "rectus femoris muscle" matches structure "rectus femoris muscle"
    if (key === normalized) {
      return { ...value, fuzzy: false };
    }
    
    // Check for meaningful overlap (at least 2 significant words match in order)
    // and the match represents the "core" of the structure name
    const significantKeyWords = keyWords.filter(w => w.length > 3);
    const significantNormWords = normalizedWords.filter(w => w.length > 3);
    
    if (significantKeyWords.length >= 2 && significantNormWords.length >= 2) {
      // Check if key words appear in the normalized name in the same order
      let keyIdx = 0;
      let matchCount = 0;
      
      for (const normWord of significantNormWords) {
        if (keyIdx < significantKeyWords.length && normWord === significantKeyWords[keyIdx]) {
          matchCount++;
          keyIdx++;
        }
      }
      
      // Require at least 2 matching words AND those words represent >50% of the key
      if (matchCount >= 2 && matchCount >= significantKeyWords.length * 0.7) {
        return { ...value, fuzzy: true };
      }
    }
  }
  
  return null;
}

function processStructure(structure, descriptionMatch) {
  const content = descriptionMatch.content;
  
  // Parse attachments as JSON structure
  const origin = extractField(content, EXTRACTION_PATTERNS.origin);
  const insertion = extractField(content, EXTRACTION_PATTERNS.insertion);
  
  const attachments = {};
  if (origin) attachments.origin = origin;
  if (insertion) attachments.insertion = insertion;
  
  return {
    mesh_id: normalizeName(structure.name).replace(/\s+/g, '_'),
    original_name: structure.name,
    region: structure.region,
    
    // Clinical fields
    clinical_description: cleanDescription(content),
    innervation: extractField(content, EXTRACTION_PATTERNS.innervation),
    blood_supply: extractField(content, EXTRACTION_PATTERNS.bloodSupply),
    attachments: Object.keys(attachments).length > 0 ? attachments : null,
    common_injuries: extractCommonInjuries(content),
    
    // Metadata
    _source: descriptionMatch.originalName,
    _fuzzy_match: descriptionMatch.fuzzy || false,
  };
}

function main() {
  console.log('=' .repeat(60));
  console.log('Z-ANATOMY CLINICAL DATA PROCESSOR');
  console.log('='.repeat(60));
  
  // Load files
  const { descriptions, registry, allStructures } = loadFiles();
  
  // Build index
  const descriptionIndex = buildDescriptionIndex(descriptions);
  
  // Process structures
  console.log('\nProcessing structures...');
  
  const results = {
    matched: [],
    unmatched: [],
    stats: {
      total: allStructures.length,
      matched: 0,
      unmatched: 0,
      withInnervation: 0,
      withAttachments: 0,
      withInjuries: 0,
      fuzzyMatches: 0,
    }
  };
  
  for (const structure of allStructures) {
    const match = matchStructureToDescription(structure.name, descriptionIndex);
    
    if (match) {
      const processed = processStructure(structure, match);
      results.matched.push(processed);
      results.stats.matched++;
      
      if (processed.innervation) results.stats.withInnervation++;
      if (processed.attachments) results.stats.withAttachments++;
      if (processed.common_injuries.length > 0) results.stats.withInjuries++;
      if (processed._fuzzy_match) results.stats.fuzzyMatches++;
    } else {
      results.unmatched.push(structure.name);
      results.stats.unmatched++;
    }
  }
  
  // Print stats
  console.log('\n' + '-'.repeat(40));
  console.log('RESULTS');
  console.log('-'.repeat(40));
  console.log(`  Total structures: ${results.stats.total}`);
  console.log(`  Matched: ${results.stats.matched} (${(results.stats.matched / results.stats.total * 100).toFixed(1)}%)`);
  console.log(`  Unmatched: ${results.stats.unmatched}`);
  console.log(`  Fuzzy matches: ${results.stats.fuzzyMatches}`);
  console.log(`  With innervation: ${results.stats.withInnervation}`);
  console.log(`  With attachments: ${results.stats.withAttachments}`);
  console.log(`  With injuries: ${results.stats.withInjuries}`);
  
  // Sample matched entries (to verify quality)
  console.log('\n--- Sample Matched Entries ---');
  const sampleMatched = results.matched.slice(0, 5);
  for (const entry of sampleMatched) {
    console.log(`\n  ${entry.original_name}`);
    console.log(`    Source: ${entry._source}`);
    console.log(`    Fuzzy: ${entry._fuzzy_match}`);
    console.log(`    Description preview: ${entry.clinical_description.substring(0, 100)}...`);
    if (entry.innervation) console.log(`    Innervation: ${entry.innervation}`);
    if (entry.attachments) console.log(`    Attachments: ${JSON.stringify(entry.attachments)}`);
  }
  
  // Sample unmatched
  if (results.unmatched.length > 0) {
    console.log('\n--- Sample Unmatched Structures ---');
    for (const name of results.unmatched.slice(0, 10)) {
      console.log(`  - ${name}`);
    }
  }
  
  // Write output files
  console.log('\nWriting output files...');
  
  // Clinical seed (for Supabase)
  const seedData = results.matched.map(m => ({
    mesh_id: m.mesh_id,
    clinical_description: m.clinical_description,
    innervation: m.innervation,
    blood_supply: m.blood_supply,
    attachments: m.attachments,
    common_injuries: m.common_injuries.length > 0 ? m.common_injuries : null,
    citations: ['Z-Anatomy (CC BY-SA 4.0)'],
  }));
  
  fs.writeFileSync(
    OUTPUT_FILES.clinicalSeed,
    JSON.stringify(seedData, null, 2)
  );
  console.log(`  ✓ ${OUTPUT_FILES.clinicalSeed}`);
  
  // Full report
  fs.writeFileSync(
    OUTPUT_FILES.report,
    JSON.stringify(results, null, 2)
  );
  console.log(`  ✓ ${OUTPUT_FILES.report}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('PROCESSING COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nNext steps:`);
  console.log(`1. Review structure_clinical_seed.json`);
  console.log(`2. Run seed script to populate Supabase`);
  console.log(`3. Supplement unmatched structures manually or with Claude`);
}

main();