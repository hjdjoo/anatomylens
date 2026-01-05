/**
 * Seed script: Populate Supabase `structure_details` table from structure_data_launch.json
 * 
 * FIXED: Normalizes mesh_ids to match database format (hyphens → underscores)
 * 
 * Usage:
 *   1. Set environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   2. Place structure_data_launch.json in src/data/
 *   3. Run: npx tsx seed_structure_details.ts
 */

import { createClient } from '@supabase/supabase-js';
import "@dotenvx/dotenvx/config";

// Load clinical data - adjust path as needed
import clinicalData from '../data/structure_data_launch.json' with {type: "json"};

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing environment variables: SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

// Type definitions
interface ClinicalEntry {
  mesh_id: string;
  name: string;
  region?: string;
  structure_type?: string;
  laterality?: string;
  summary?: string;
  description?: string;
  actions?: string[];
  attachments?: {
    origin?: string;
    insertion?: string;
  };
  innervation?: string;
  articulations?: string;
  _source?: string[] | string;
}

interface ClinicalDataFile {
  matched: ClinicalEntry[];
  unmatched: string[];
  stats: Record<string, unknown>;
}

// Default sources for attribution
const DEFAULT_SOURCES = ['Wikipedia', 'Z-Anatomy'];

/**
 * Normalize mesh_id to match database format.
 * Key fix: Convert hyphens to underscores to match export_anatomy.py normalization.
 */
function normalizeMeshId(meshId: string): string {
  return meshId
    .toLowerCase()
    .replace(/-/g, '_')      // Key fix: hyphens → underscores
    .replace(/\s+/g, '_')
    .replace(/\.+/g, '_')
    .replace(/[()]/g, '')
    .replace(/_+/g, '_')     // Collapse multiple underscores
    .replace(/^_|_$/g, '');  // Trim leading/trailing underscores
}

async function getStructureIdMap(): Promise<Map<string, string>> {
  console.log('Fetching structure IDs from database...');
  
  const { data, error } = await supabase
    .from('structures')
    .select('id, mesh_id, side');
  
  if (error) {
    throw new Error(`Failed to fetch structures: ${error.message}`);
  }
  
  // Create map: normalized mesh_id → structure UUID
  // Note: For bilateral structures, the same mesh_id may map to the same structure
  const idMap = new Map<string, string>();
  
  for (const row of data || []) {
    const normalizedId = normalizeMeshId(row.mesh_id);
    
    // Store by normalized mesh_id
    if (!idMap.has(normalizedId)) {
      idMap.set(normalizedId, row.id);
    }
    
    // Also store the original mesh_id (in case it's already normalized)
    if (!idMap.has(row.mesh_id)) {
      idMap.set(row.mesh_id, row.id);
    }
  }
  
  console.log(`  Found ${data?.length || 0} structures in database`);
  console.log(`  Created ${idMap.size} lookup mappings`);
  return idMap;
}

async function seedStructureDetails() {
  console.log('='.repeat(60));
  console.log('BodyGuide Structure Details Seeding');
  console.log('='.repeat(60));
  console.log();
  
  const data = clinicalData as ClinicalDataFile;
  console.log(`Clinical entries to process: ${data.matched.length}`);
  console.log();
  
  // Get structure ID mappings
  const structureIdMap = await getStructureIdMap();
  
  // Prepare records
  const records: Array<{
    structure_id: string;
    description: string | null;
    summary: string | null;
    actions: string[] | null;
    attachments: Record<string, unknown> | null;
    innervation: string | null;
    source: string[];
  }> = [];
  
  let matched = 0;
  let unmatched = 0;
  const unmatchedEntries: Array<{ name: string; meshId: string; normalized: string }> = [];
  
  for (const entry of data.matched) {
    // Normalize the mesh_id to match database format
    const normalizedMeshId = normalizeMeshId(entry.mesh_id);
    
    // Try to find structure ID (check both normalized and original)
    let structureId = structureIdMap.get(normalizedMeshId);
    if (!structureId) {
      structureId = structureIdMap.get(entry.mesh_id);
    }
    
    if (!structureId) {
      unmatched++;
      if (unmatchedEntries.length < 30) {
        unmatchedEntries.push({
          name: entry.name,
          meshId: entry.mesh_id,
          normalized: normalizedMeshId
        });
      }
      continue;
    }
    
    matched++;
    
    // Build attachments object (include articulations for bones)
    let attachments: Record<string, unknown> | null = null;
    if (entry.attachments || entry.articulations) {
      attachments = {};
      if (entry.attachments?.origin) {
        attachments.origin = entry.attachments.origin;
      }
      if (entry.attachments?.insertion) {
        attachments.insertion = entry.attachments.insertion;
      }
      if (entry.articulations) {
        attachments.articulations = entry.articulations;
      }
    }
    
    records.push({
      structure_id: structureId,
      description: entry.description || null,
      summary: entry.summary || null,
      actions: entry.actions || null,
      attachments,
      innervation: entry.innervation || null,
      source: DEFAULT_SOURCES,
    });
  }
  
  console.log(`Matched to structures: ${matched}`);
  console.log(`Could not match: ${unmatched}`);
  
  if (unmatchedEntries.length > 0) {
    console.log('\nUnmatched entries (mesh_id → normalized):');
    unmatchedEntries.forEach(({ name, meshId, normalized }) => {
      console.log(`  - ${name}`);
      console.log(`    original:   ${meshId}`);
      console.log(`    normalized: ${normalized}`);
    });
    if (unmatched > 30) {
      console.log(`  ... and ${unmatched - 30} more`);
    }
  }
  console.log();
  
  // Deduplicate by structure_id (merge data from left/right variants)
  const uniqueRecords = new Map<string, typeof records[0]>();
  for (const record of records) {
    const existing = uniqueRecords.get(record.structure_id);
    if (!existing) {
      uniqueRecords.set(record.structure_id, record);
    } else {
      // Merge: prefer non-null values
      if (!existing.description && record.description) {
        existing.description = record.description;
      }
      if (!existing.summary && record.summary) {
        existing.summary = record.summary;
      }
      if (!existing.actions && record.actions) {
        existing.actions = record.actions;
      }
      if (!existing.attachments && record.attachments) {
        existing.attachments = record.attachments;
      }
      if (!existing.innervation && record.innervation) {
        existing.innervation = record.innervation;
      }
    }
  }
  
  const finalRecords = Array.from(uniqueRecords.values());
  console.log(`Unique structure records: ${finalRecords.length}`);
  console.log();
  
  // Insert in batches
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;
  
  console.log('Inserting structure details...');
  
  for (let i = 0; i < finalRecords.length; i += BATCH_SIZE) {
    const batch = finalRecords.slice(i, i + BATCH_SIZE);
    
    const { data: result, error } = await supabase
      .from('structure_details')
      .upsert(batch, {
        onConflict: 'structure_id',
        ignoreDuplicates: false
      })
      .select('id');
    
    if (error) {
      console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += result?.length || 0;
      process.stdout.write(`\rProgress: ${inserted}/${finalRecords.length}`);
    }
  }
  
  console.log('\n');
  console.log('='.repeat(60));
  console.log('Seed complete!');
  console.log('='.repeat(60));
  console.log(`  Total clinical entries: ${data.matched.length}`);
  console.log(`  Matched to structures: ${matched}`);
  console.log(`  Unique records created: ${finalRecords.length}`);
  console.log(`  Successfully inserted: ${inserted}`);
  console.log(`  Errors: ${errors}`);
  console.log();
  
  // Verify with stats
  const { data: stats } = await supabase
    .from('structure_details')
    .select('id, description, summary, actions, attachments, innervation')
    .then(({ data }) => {
      if (!data) return { data: null };
      return {
        data: {
          total: data.length,
          withDescription: data.filter(r => r.description).length,
          withSummary: data.filter(r => r.summary).length,
          withActions: data.filter(r => r.actions && r.actions.length > 0).length,
          withAttachments: data.filter(r => r.attachments).length,
          withInnervation: data.filter(r => r.innervation).length,
        }
      };
    });
  
  if (stats) {
    console.log('Database verification:');
    console.log(`  Total records: ${stats.total}`);
    console.log(`  With description: ${stats.withDescription}`);
    console.log(`  With summary: ${stats.withSummary}`);
    console.log(`  With actions: ${stats.withActions}`);
    console.log(`  With attachments: ${stats.withAttachments}`);
    console.log(`  With innervation: ${stats.withInnervation}`);
  }
}

// Run
seedStructureDetails().catch(console.error);