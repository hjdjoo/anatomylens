/**
 * Seed script: Populate Supabase `structure_clinical` table
 * 
 * Usage:
 *   1. First run: node process_zanatomy_clinical.js
 *   2. Then run: npx tsx seed_structure_clinical.ts
 * 
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SECRET_KEY env vars set
 *   - structure_clinical_seed.json exists in src/data/
 *   - structures table already seeded (need structure IDs)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import "@dotenvx/dotenvx/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing environment variables: SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const SEED_FILE = path.join(__dirname, 'src', 'data', 'structure_clinical_seed.json');
const BATCH_SIZE = 50;

// ============================================================
// TYPES
// ============================================================

interface ClinicalSeedEntry {
  mesh_id: string;
  clinical_description: string;
  innervation: string | null;
  blood_supply: string | null;
  attachments: { origin?: string; insertion?: string } | null;
  common_injuries: string[] | null;
  citations: string[];
}

// ============================================================
// MAIN
// ============================================================

async function seedStructureClinical() {
  console.log('='.repeat(60));
  console.log('SEEDING STRUCTURE_CLINICAL TABLE');
  console.log('='.repeat(60));

  // Load seed data
  console.log('\nLoading seed data...');
  const seedData: ClinicalSeedEntry[] = JSON.parse(
    fs.readFileSync(SEED_FILE, 'utf-8')
  );
  console.log(`  Loaded ${seedData.length} entries`);

  // First, fetch all structure IDs from the structures table
  console.log('\nFetching structure IDs from database...');
  const { data: structures, error: fetchError } = await supabase
    .from('structures')
    .select('id, mesh_id');

  if (fetchError) {
    console.error('Failed to fetch structures:', fetchError.message);
    process.exit(1);
  }

  // Build mesh_id -> structure_id map
  const structureIdMap = new Map<string, string>();
  for (const s of structures || []) {
    structureIdMap.set(s.mesh_id, s.id);
  }
  console.log(`  Found ${structureIdMap.size} structures in database`);

  // Process seed entries
  console.log('\nProcessing seed entries...');
  
  const toInsert: Array<{
    structure_id: string;
    clinical_description: string | null;
    innervation: string | null;
    blood_supply: string | null;
    attachments: object | null;
    common_injuries: string[] | null;
    citations: string[] | null;
  }> = [];
  
  let matchedCount = 0;
  let unmatchedCount = 0;
  const unmatched: string[] = [];

  for (const entry of seedData) {
    const structureId = structureIdMap.get(entry.mesh_id);
    
    if (structureId) {
      toInsert.push({
        structure_id: structureId,
        clinical_description: entry.clinical_description || null,
        innervation: entry.innervation || null,
        blood_supply: entry.blood_supply || null,
        attachments: entry.attachments || null,
        common_injuries: entry.common_injuries || null,
        citations: entry.citations || null,
      });
      matchedCount++;
    } else {
      unmatchedCount++;
      if (unmatched.length < 20) {
        unmatched.push(entry.mesh_id);
      }
    }
  }

  console.log(`  Matched to structure IDs: ${matchedCount}`);
  console.log(`  No matching structure: ${unmatchedCount}`);
  
  if (unmatched.length > 0) {
    console.log('\n  Sample unmatched mesh_ids:');
    for (const id of unmatched.slice(0, 10)) {
      console.log(`    - ${id}`);
    }
  }

  // Insert in batches
  console.log(`\nInserting ${toInsert.length} clinical records...`);
  
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('structure_clinical')
      .upsert(batch, {
        onConflict: 'structure_id',
        ignoreDuplicates: false,
      })
      .select('structure_id');

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || 0;
      process.stdout.write(`\r  Inserted: ${inserted}/${toInsert.length}`);
    }
  }

  console.log('\n');

  // Final stats
  console.log('='.repeat(60));
  console.log('SEEDING COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total seed entries: ${seedData.length}`);
  console.log(`  Matched to structures: ${matchedCount}`);
  console.log(`  Successfully inserted: ${inserted}`);
  console.log(`  Errors: ${errors}`);
  
  // Verify by counting
  const { count } = await supabase
    .from('structure_clinical')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n  Total records in structure_clinical: ${count}`);
  console.log('='.repeat(60));
}

seedStructureClinical().catch(console.error);
