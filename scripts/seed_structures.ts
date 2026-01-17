/**
 * Seed script: Populate Supabase `structures` table from body_metadata.json
 * 
 * Usage:
 *   1. Set environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   2. Run: npx tsx seed_structures.ts
 * 
 * Note: Uses service role key to bypass RLS for seeding
 */

import { createClient } from '@supabase/supabase-js';
import bodyMetadata from '../src/data/body_metadata.json' with {type: "json"};

import "@dotenvx/dotenvx/config"

import { MetadataFile } from '../src/components/viewer/AnatomyModelGLTF.tsx'

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL) {
  console.error('Missing environment variables: SUPABASE_URL');
  process.exit(1);
}
if (!SUPABASE_SECRET_KEY) {
  console.error('Missing environment variables: SUPABASE_SECRET_KEY');
  process.exit(1);
}

// Use service role for admin operations (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);


async function seedStructures() {
  console.log('Starting structures seed...\n');

  const metadata = JSON.parse(JSON.stringify(bodyMetadata)) as MetadataFile;
  const structures = Object.values(metadata.structures);

  console.log(`Found ${structures.length} structures in metadata`);

  // Prepare records for insert
  const records = structures.map((s) => ({
    mesh_id: s.meshId,
    original_name: s.originalName,
    type: s.type,
    region: s.region,
    layer: s.layer,
    // summary left null - can be populated later
  }));

  // Insert in batches of 100 (Supabase limit)
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('structures')
      .upsert(batch, {
        onConflict: 'mesh_id',
        ignoreDuplicates: false
      })
      .select('mesh_id');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || 0;
      process.stdout.write(`\rInserted: ${inserted}/${records.length}`);
    }
  }

  console.log('\n');
  console.log('='.repeat(50));
  console.log('Seed complete!');
  console.log(`  Total in metadata: ${records.length}`);
  console.log(`  Successfully inserted/updated: ${inserted}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(50));

  // Verify counts by type
  const { data: typeCounts } = await supabase
    .from('structures')
    .select('type')
    .then(({ data }) => {
      const counts: Record<string, number> = {};
      data?.forEach((row) => {
        counts[row.type] = (counts[row.type] || 0) + 1;
      });
      return { data: counts };
    });

  console.log('\nStructures by type:');
  Object.entries(typeCounts || {})
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

seedStructures().catch(console.error);
