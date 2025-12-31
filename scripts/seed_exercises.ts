/**
 * Seed script: Populate exercises and structure_exercises from exercise_seed_data.json
 * 
 * Usage:
 *   1. Set environment variables SUPABASE_URL and SUPABASE_SECRET_KEY
 *   2. Ensure structures table is already seeded (run seed_structures.ts first)
 *   3. Run: npx tsx seed_exercises.ts
 * 
 * Note: Uses service role key to bypass RLS for seeding
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

import "@dotenvx/dotenvx/config";

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing environment variables: SUPABASE_URL and/or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

// Types
interface ExerciseSeedData {
  name: string;
  slug: string;
  difficulty: number;
  equipment: string[];
  category: string;
  movement_pattern: string;
  primary_structures: string[];
  secondary_structures: string[];
  stabilizer_structures: string[];
}

interface SeedFile {
  _metadata: {
    version: string;
    total_exercises: number;
  };
  exercises: ExerciseSeedData[];
}

// Stats tracking
const stats = {
  exercisesInserted: 0,
  exercisesSkipped: 0,
  mappingsInserted: 0,
  mappingsFailed: 0,
  structuresNotFound: new Set<string>(),
};

/**
 * Load and cache structure mesh_id -> id and original_name -> id mappings
 */
async function loadStructureMaps(): Promise<{
  meshIdMap: Map<string, string>;
  originalNameMap: Map<string, string>;
}> {
  console.log('Loading structure ID mappings...');

  const { data, error } = await supabase
    .from('structures')
    .select('id, mesh_id, original_name');

  if (error) {
    throw new Error(`Failed to load structures: ${error.message}`);
  }

  const meshIdMap = new Map<string, string>();
  const originalNameMap = new Map<string, string>();

  data?.forEach((row) => {
    meshIdMap.set(row.mesh_id, row.id);
    originalNameMap.set(row.original_name, row.id);
  });

  console.log(`  Loaded ${meshIdMap.size} structure mappings`);
  return { meshIdMap, originalNameMap };
}

/**
 * Normalize a mesh_id to a standard format for matching
 */
function normalizeMeshId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/\./g, '_')
    .replace(/[()]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_[lr]$/, ''); // Remove side suffix for bilateral matching
}

/**
 * Resolve a mesh_id pattern to actual structure IDs
 * Handles bilateral structures and various naming conventions
 */
function resolveStructureIds(
  meshIdBase: string,
  structureMap: Map<string, string>,
  originalNameMap: Map<string, string>
): string[] {
  const ids: string[] = [];
  const normalizedInput = normalizeMeshId(meshIdBase);

  // Try exact match on mesh_id first
  if (structureMap.has(meshIdBase)) {
    ids.push(structureMap.get(meshIdBase)!);
    return ids;
  }

  // Try normalized match against all mesh_ids
  for (const [meshId, structureId] of structureMap) {
    const normalizedMeshId = normalizeMeshId(meshId);
    if (normalizedMeshId === normalizedInput) {
      ids.push(structureId);
    }
  }

  if (ids.length > 0) {
    return [...new Set(ids)];
  }

  // Try matching against original_name (with normalization)
  for (const [originalName, structureId] of originalNameMap) {
    const normalizedOriginal = normalizeMeshId(originalName);
    if (normalizedOriginal === normalizedInput) {
      ids.push(structureId);
    }
  }

  return [...new Set(ids)]; // Deduplicate
}

/**
 * Insert an exercise and return its ID
 */
async function insertExercise(exercise: ExerciseSeedData): Promise<string | null> {
  const { data, error } = await supabase
    .from('exercises')
    .upsert({
      name: exercise.name,
      slug: exercise.slug,
      difficulty: exercise.difficulty,
      equipment: exercise.equipment,
      category: exercise.category,
      movement_pattern: exercise.movement_pattern,
      status: 'published',
      // These fields can be populated later
      description: null,
      instructions: null,
      cues: null,
      common_mistakes: null,
      video_url: null,
      thumbnail_url: null,
    }, {
      onConflict: 'slug',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  Failed to insert exercise "${exercise.name}": ${error.message}`);
    return null;
  }

  return data?.id || null;
}

/**
 * Insert structure-exercise mapping
 */
async function insertStructureExercise(
  structureId: string,
  exerciseId: string,
  involvement: 'primary' | 'secondary' | 'stabilizer' | 'stretched'
): Promise<boolean> {
  // First check if mapping already exists
  const { data: existing } = await supabase
    .from('structure_exercises')
    .select('id')
    .eq('structure_id', structureId)
    .eq('exercise_id', exerciseId)
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('structure_exercises')
      .update({ involvement, status: 'published' })
      .eq('id', existing.id);

    return !error;
  }

  // Insert new
  const { error } = await supabase
    .from('structure_exercises')
    .insert({
      structure_id: structureId,
      exercise_id: exerciseId,
      involvement,
      status: 'published',
    });

  if (error) {
    // Ignore duplicate key errors
    if (error.code === '23505') {
      return true;
    }
    console.error(`    Failed to insert mapping: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Process a single exercise
 */
async function processExercise(
  exercise: ExerciseSeedData,
  meshIdMap: Map<string, string>,
  originalNameMap: Map<string, string>
): Promise<void> {
  // Insert exercise
  const exerciseId = await insertExercise(exercise);

  if (!exerciseId) {
    stats.exercisesSkipped++;
    return;
  }

  stats.exercisesInserted++;

  // Process structure mappings
  const mappings: Array<{ meshId: string; involvement: 'primary' | 'secondary' | 'stabilizer' }> = [];

  exercise.primary_structures.forEach((meshId) => {
    mappings.push({ meshId, involvement: 'primary' });
  });

  exercise.secondary_structures.forEach((meshId) => {
    mappings.push({ meshId, involvement: 'secondary' });
  });

  exercise.stabilizer_structures.forEach((meshId) => {
    mappings.push({ meshId, involvement: 'stabilizer' });
  });

  for (const { meshId, involvement } of mappings) {
    const structureIds = resolveStructureIds(meshId, meshIdMap, originalNameMap);

    if (structureIds.length === 0) {
      stats.structuresNotFound.add(meshId);
      stats.mappingsFailed++;
      continue;
    }

    for (const structureId of structureIds) {
      const success = await insertStructureExercise(structureId, exerciseId, involvement);
      if (success) {
        stats.mappingsInserted++;
      } else {
        stats.mappingsFailed++;
      }
    }
  }
}

/**
 * Main seed function
 */
async function seedExercises() {
  console.log('='.repeat(60));
  console.log('EXERCISE SEED SCRIPT');
  console.log('='.repeat(60));

  // Load seed data
  const seedPath = path.join(__dirname, 'exercise_seed_data.json');

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    console.error('Please ensure exercise_seed_data.json is in the same directory');
    process.exit(1);
  }

  const seedData: SeedFile = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  console.log(`\nLoaded ${seedData.exercises.length} exercises from seed file`);

  // Load structure mappings
  const { meshIdMap, originalNameMap } = await loadStructureMaps();

  if (meshIdMap.size === 0) {
    console.error('\nNo structures found in database!');
    console.error('Please run seed_structures.ts first');
    process.exit(1);
  }

  // Process exercises
  console.log('\nProcessing exercises...');

  for (let i = 0; i < seedData.exercises.length; i++) {
    const exercise = seedData.exercises[i];
    process.stdout.write(`\r  Processing: ${i + 1}/${seedData.exercises.length} - ${exercise.name.padEnd(30)}`);
    await processExercise(exercise, meshIdMap, originalNameMap);
  }

  console.log('\n');

  // Print results
  console.log('='.repeat(60));
  console.log('SEED COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nExercises:`);
  console.log(`  Inserted/Updated: ${stats.exercisesInserted}`);
  console.log(`  Skipped (errors): ${stats.exercisesSkipped}`);
  console.log(`\nStructure Mappings:`);
  console.log(`  Inserted: ${stats.mappingsInserted}`);
  console.log(`  Failed: ${stats.mappingsFailed}`);

  if (stats.structuresNotFound.size > 0) {
    console.log(`\n⚠️  Structures not found in database (${stats.structuresNotFound.size}):`);
    const sorted = [...stats.structuresNotFound].sort();
    sorted.slice(0, 20).forEach((meshId) => {
      console.log(`    - ${meshId}`);
    });
    if (sorted.length > 20) {
      console.log(`    ... and ${sorted.length - 20} more`);
    }
    console.log('\n  These mesh_ids may need to be added to body_registry.json');
    console.log('  or the naming convention may need adjustment.');
  }

  // Verification queries
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION');
  console.log('='.repeat(60));

  const { count: exerciseCount } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });

  const { count: mappingCount } = await supabase
    .from('structure_exercises')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal in database:`);
  console.log(`  Exercises: ${exerciseCount}`);
  console.log(`  Structure-Exercise mappings: ${mappingCount}`);

  // Sample exercises by category
  const { data: categoryCounts } = await supabase
    .from('exercises')
    .select('category');

  const byCategory: Record<string, number> = {};
  categoryCounts?.forEach((row) => {
    const cat = row.category || 'uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  console.log(`\nExercises by category:`);
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
}

seedExercises().catch(console.error);