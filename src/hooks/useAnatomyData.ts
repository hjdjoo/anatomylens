/**
 * React hooks for fetching anatomy-related data from Supabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useHasTier, useUserProfile } from './useUserProfile';
import { useAuth } from '@/contexts/AuthContext';

import { Tables } from 'database.types';

// ============================================================
// TYPES
// ============================================================

export type Exercise = Tables<"exercises">

export type StructureExercise = Tables<"structure_exercises">

export type ExerciseData = {
  exercise: Exercise;
  involvement: StructureExercise["involvement"];
  notes: string | null;
}

// Sort mode for exercises
export type ExerciseSortMode = 'involvement' | 'difficulty';

// Structure details (from structure_details table)

export type StructureDetails = {
  id: string;
  structure_id: string;
  // Free tier
  summary: string | null;
  actions: string[] | null;
  // Premium tier
  description: string | null;
  attachments: { origin?: string; insertion?: string } | null;
  innervation: string | null;
  articulations: string | null;
  // Metadata
  source: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================
// UTILITY: DEBOUNCE HOOK
// ============================================================

export function useDebouncedCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

// ============================================================
// UTILITY: TIME PARSING
// ============================================================

/**
 * Parse mm:ss or plain seconds string to total seconds
 * @example "1:30" -> 90, "90" -> 90, "2:00" -> 120
 */
export function parseRestTime(input: string): number | null {
  if (!input || input.trim() === '') return null;

  const trimmed = input.trim();

  // Check for mm:ss format
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;

    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);

    if (isNaN(minutes) || isNaN(seconds)) return null;
    if (seconds < 0 || seconds > 59) return null;
    if (minutes < 0) return null;

    return minutes * 60 + seconds;
  }

  // Plain seconds
  const seconds = parseInt(trimmed, 10);
  if (isNaN(seconds) || seconds < 0) return null;

  return seconds;
}

/**
 * Format seconds to mm:ss string
 * @example 90 -> "1:30", 120 -> "2:00", 45 -> "0:45"
 */
export function formatRestTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}


// ============================================================
// EXERCISES FOR STRUCTURE HOOK
// ============================================================

interface UseStructureExercisesOptions {
  enabled?: boolean;
}

export function useStructureExercises(
  meshId: string | null,
  options: UseStructureExercisesOptions = {}
) {
  const { enabled = true } = options;
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { hasTier } = useHasTier(1);

  const fetchExercises = useCallback(async () => {
    if (!supabase || !meshId || !enabled || !hasTier) {
      setExercises([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First get the structure ID from mesh_id
      const { data: structure, error: structureError } = await supabase
        .from('structures')
        .select('id')
        .eq('mesh_id', meshId)
        .single();

      if (structureError) {
        // Structure might not be in DB yet, not an error
        if (structureError.code === 'PGRST116') {
          setExercises([]);
          return;
        }
        throw structureError;
      }

      // Fetch exercises for this structure
      const { data, error: exercisesError } = await supabase
        .from('structure_exercises')
        .select(`
          involvement,
          notes,
          exercise:exercises (
            id,
            name,
            slug,
            description,
            difficulty,
            equipment,
            category,
            movement_pattern,
            video_url,
            thumbnail_url,
            instructions,
            cues,
            common_mistakes
          )
        `)
        .eq('structure_id', structure.id)
        .eq('status', 'published');

      if (exercisesError) {
        // RLS will block if user doesn't have tier - expected behavior
        if (exercisesError.code === 'PGRST301' || exercisesError.message.includes('permission')) {
          setExercises([]);
          return;
        }
        throw exercisesError;
      }

      // Transform the data
      const transformed: ExerciseData[] = (data || [{}])
        .filter((row) => row.exercise) // Filter out any nulls
        .map((row) => ({
          exercise: row.exercise as Exercise,
          involvement: row.involvement as StructureExercise['involvement'],
          notes: row.notes,
        }));

      // Sort by involvement: primary first, then secondary, then stabilizer, then stretched
      const involvementOrder = { primary: 0, secondary: 1, stabilizer: 2, stretched: 3 } as { [involvement: string]: number };
      transformed.sort((a, b) =>
        involvementOrder[a.involvement] - involvementOrder[b.involvement]
      );

      setExercises(transformed);
    } catch (err) {
      console.error('Error fetching exercises:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch exercises'));
    } finally {
      setLoading(false);
    }
  }, [meshId, enabled]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  return {
    exercises,
    loading,
    error,
    hasTier,
    refetch: fetchExercises,
  };
}

// ============================================================
// ALL EXERCISES HOOK (for exercise browser)
// ============================================================

interface UseExercisesOptions {
  difficulty?: number;
  category?: string;
  equipment?: string;
  search?: string;
  limit?: number;
}

export function useExercises(options: UseExercisesOptions = {}) {
  const { difficulty, category, equipment, search, limit = 50 } = options;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supabase) {
      setExercises([]);
      return;
    }

    async function fetchExercises() {
      setLoading(true);
      setError(null);
      if (!supabase) {
        setExercises([]);
        return;
      }

      try {
        let query = supabase
          .from('exercises')
          .select('*')
          .eq('status', 'published')
          .limit(limit);

        if (difficulty) {
          query = query.eq('difficulty', difficulty);
        }
        if (category) {
          query = query.eq('category', category);
        }
        if (equipment) {
          query = query.contains('equipment', [equipment]);
        }
        if (search) {
          query = query.ilike('name', `%${search}%`);
        }

        const { data, error } = await query.order('name');

        if (error) throw error;
        setExercises(data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch exercises'));
      } finally {
        setLoading(false);
      }
    }

    fetchExercises();
  }, [difficulty, category, equipment, search, limit]);

  return { exercises, loading, error };
}

// ============================================================
// STRUCTURE DETAILS HOOK
// ============================================================

export function useStructureDetails(meshId: string | null) {
  const [details, setDetails] = useState<StructureDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { hasTier, loading: tierLoading } = useHasTier(1);

  useEffect(() => {
    if (!supabase || !meshId) {
      setDetails(null);
      return;
    }

    async function fetchDetails() {
      setLoading(true);
      setError(null);
      if (!supabase || !meshId) {
        setDetails(null);
        return;
      }

      try {
        // First get the structure ID from mesh_id
        const { data: structure, error: structureError } = await supabase
          .from('structures')
          .select('id')
          .eq('mesh_id', meshId)
          .single();

        if (structureError) {
          // Structure might not be in DB yet
          if (structureError.code === 'PGRST116') {
            setDetails(null);
            return;
          }
          throw structureError;
        }

        if (hasTier) {
          // Fetch details for this structure
          const { data, error: detailsError } = await supabase
            .from('structure_details')
            .select('*')
            .eq('structure_id', structure.id)
            .single();

          if (detailsError) {
            // No details found is not an error
            if (detailsError.code === 'PGRST116') {
              setDetails(null);
              return;
            }
            throw detailsError;
          }

          setDetails(data as StructureDetails);
        } else {
          const { data, error: detailsError } = await supabase
            .from('structure_details')
            .select('id, structure_id, summary, actions, source, created_at, updated_at')
            .eq('structure_id', structure.id)
            .single();

          if (detailsError) {
            // No details found is not an error
            if (detailsError.code === 'PGRST116') {
              setDetails(null);
              return;
            }
            throw detailsError;
          }

          const blankData = {
            description: null,
            attachments: null,
            innervation: null,
            articulations: null
          }

          const details = Object.assign({}, data, blankData) as StructureDetails;

          setDetails(details);
        }

      } catch (err) {
        console.error('Error fetching structure details:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch details'));
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [meshId]);

  return {
    details,
    loading: loading || tierLoading,
    error,
    hasTier,
  };
}

// ============================================================
// USER EXERCISE LIBRARY TYPES
// ============================================================

export type UserExercise = {
  id: string;
  user_id: string;
  exercise_id: string;
  notes: string | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rest_seconds: number | null;
  added_at: string | null;
}

export type SavedExerciseWithDetails = {
  userExercise: UserExercise;
  exercise: Exercise;
  region: string | null; // From structure for grouping
}

// Fields that can be updated on a user exercise
export type UserExerciseUpdate = {
  sets?: number;
  reps?: number;
  weight?: number;
  rest_seconds?: number;
  notes?: string;
}

// ============================================================
// USER EXERCISE LIBRARY HOOK
// ============================================================

export function useUserExercises() {
  const [savedExercises, setSavedExercises] = useState<SavedExerciseWithDetails[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set()); // Track which are saving
  const { hasTier } = useHasTier(1);
  const { profile } = useUserProfile();
  const { user, userId, loading: authLoading } = useAuth();

  // Fetch all saved exercises for the user
  const fetchSavedExercises = useCallback(async () => {
    if (!supabase || !userId || !hasTier) {
      setSavedExercises([]);
      setSavedIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user's saved exercises with exercise details
      const { data, error: fetchError } = await supabase
        .from('user_exercises')
        .select(`
          id,
          user_id,
          exercise_id,
          notes,
          sets,
          reps,
          weight,
          rest_seconds,
          added_at,
          exercise:exercises (
            id,
            name,
            slug,
            description,
            difficulty,
            equipment,
            category,
            movement_pattern,
            video_url,
            thumbnail_url,
            instructions,
            cues,
            common_mistakes
          )
        `)
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Get unique exercise IDs to fetch their primary structure regions
      const exerciseIds = (data || []).map(d => d.exercise_id);

      // Fetch regions for these exercises (get primary structure for each)
      let regionMap: Record<string, string> = {};
      if (exerciseIds.length > 0) {
        const { data: structureData } = await supabase
          .from('structure_exercises')
          .select(`
            exercise_id,
            structure:structures (
              region
            )
          `)
          .in('exercise_id', exerciseIds)
          .eq('involvement', 'primary');

        if (structureData) {
          structureData.forEach((se: unknown) => {
            const seTyped = se as { exercise_id: string; structure: { region: string } | null };
            if (seTyped.structure?.region && !regionMap[seTyped.exercise_id]) {
              regionMap[seTyped.exercise_id] = seTyped.structure.region;
            }
          });
        }
      }

      // Transform data
      const transformed: SavedExerciseWithDetails[] = (data || [])
        .filter((row: unknown) => (row as { exercise: unknown }).exercise)
        .map((row: unknown) => {
          const rowTyped = row as {
            id: string;
            user_id: string;
            exercise_id: string;
            notes: string | null;
            sets: number | null;
            reps: number | null;
            weight: number | null;
            rest_seconds: number | null;
            added_at: string | null;
            exercise: Exercise;
          };
          return {
            userExercise: {
              id: rowTyped.id,
              user_id: rowTyped.user_id,
              exercise_id: rowTyped.exercise_id,
              notes: rowTyped.notes,
              sets: rowTyped.sets,
              reps: rowTyped.reps,
              weight: rowTyped.weight,
              rest_seconds: rowTyped.rest_seconds,
              added_at: rowTyped.added_at,
            },
            exercise: rowTyped.exercise as Exercise,
            region: regionMap[rowTyped.exercise_id] || 'other',
          };
        });

      setSavedExercises(transformed);
      setSavedIds(new Set(transformed.map(e => e.exercise.id)));
    } catch (err) {
      console.error('Error fetching saved exercises:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch library'));
    } finally {
      setLoading(false);
    }
  }, [userId, hasTier]);

  // Fetch when user or tier changes
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setSavedExercises([]);
      setSavedIds(new Set());
      setLoading(false);
      return;
    }

    fetchSavedExercises();
  }, [user, authLoading, fetchSavedExercises]);

  // Update a user exercise (debounced in component, raw here)
  const updateUserExercise = useCallback(async (
    userExerciseId: string,
    updates: UserExerciseUpdate
  ): Promise<void> => {
    if (!supabase) return;

    // Mark as saving
    setSavingIds(prev => new Set(prev).add(userExerciseId));

    try {
      const { error: updateError } = await supabase
        .from('user_exercises')
        .update(updates)
        .eq('id', userExerciseId);

      if (updateError) throw updateError;

      // Update local state optimistically
      setSavedExercises(prev => prev.map(item => {
        if (item.userExercise.id === userExerciseId) {
          return {
            ...item,
            userExercise: {
              ...item.userExercise,
              ...updates,
            },
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Error updating exercise:', err);
      throw err;
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(userExerciseId);
        return next;
      });
    }
  }, []);

  // Toggle save/unsave an exercise
  const toggleSave = useCallback(async (exerciseId: string): Promise<boolean> => {
    if (!supabase || !userId) return false;

    try {
      const isCurrentlySaved = savedIds.has(exerciseId);

      if (isCurrentlySaved) {
        // Remove from library
        const { error: deleteError } = await supabase
          .from('user_exercises')
          .delete()
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId);

        if (deleteError) throw deleteError;

        // Update local state
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(exerciseId);
          return next;
        });
        setSavedExercises(prev => prev.filter(e => e.exercise.id !== exerciseId));
        return false; // Now unsaved
      } else {
        // Add to library
        const { error: insertError } = await supabase
          .from('user_exercises')
          .insert({
            user_id: userId,
            exercise_id: exerciseId,
          });

        if (insertError) throw insertError;

        // Refetch to get full data (simpler than reconstructing)
        await fetchSavedExercises();
        return true; // Now saved
      }
    } catch (err) {
      console.error('Error toggling exercise save:', err);
      throw err;
    }
  }, [savedIds, fetchSavedExercises, userId]);

  // Check if a specific exercise is saved
  const isSaved = useCallback((exerciseId: string): boolean => {
    return savedIds.has(exerciseId);
  }, [savedIds]);

  // Check if a specific exercise is currently saving
  const isSaving = useCallback((userExerciseId: string): boolean => {
    return savingIds.has(userExerciseId);
  }, [savingIds]);

  return {
    savedExercises,
    savedIds,
    loading,
    error,
    hasTier,
    toggleSave,
    isSaved,
    isSaving,
    updateUserExercise,
    refetch: fetchSavedExercises,
    weightUnit: profile?.weight_unit || 'lbs',
  };
}

// ============================================================
// EXPORT UTILITIES
// ============================================================

/**
 * Generate CSV content from saved exercises
 */
export function generateExerciseCSV(
  exercises: SavedExerciseWithDetails[],
  weightUnit: 'lbs' | 'kg' | string
): string {
  const headers = ['Exercise', 'Region', 'Sets', 'Reps', `Weight (${weightUnit})`, 'Rest', 'Notes'];

  const rows = exercises.map(({ exercise, userExercise, region }) => [
    // Escape quotes in exercise name
    `"${exercise.name.replace(/"/g, '""')}"`,
    region || '',
    userExercise.sets ?? '',
    userExercise.reps ?? '',
    userExercise.weight ?? '',
    userExercise.rest_seconds ? formatRestTime(userExercise.rest_seconds) : '',
    // Escape quotes and newlines in notes
    userExercise.notes ? `"${userExercise.notes.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate plain text workout summary
 */
export function generateExerciseText(
  exercises: SavedExerciseWithDetails[],
  weightUnit: 'lbs' | 'kg' | string
): string {
  const lines: string[] = ['My Workout', '='.repeat(40), ''];

  // Group by region
  const byRegion: Record<string, SavedExerciseWithDetails[]> = {};
  exercises.forEach(e => {
    const region = e.region || 'Other';
    if (!byRegion[region]) byRegion[region] = [];
    byRegion[region].push(e);
  });

  Object.entries(byRegion).forEach(([region, items]) => {
    lines.push(`## ${region.replace(/_/g, ' ').toUpperCase()}`);
    lines.push('');

    items.forEach(({ exercise, userExercise }) => {
      const parts: string[] = [exercise.name];

      if (userExercise.sets || userExercise.reps) {
        const setsReps = [
          userExercise.sets ? `${userExercise.sets} sets` : '',
          userExercise.reps ? `${userExercise.reps} reps` : '',
        ].filter(Boolean).join(' x ');
        if (setsReps) parts.push(`- ${setsReps}`);
      }

      if (userExercise.weight) {
        parts.push(`@ ${userExercise.weight} ${weightUnit}`);
      }

      if (userExercise.rest_seconds) {
        parts.push(`(rest: ${formatRestTime(userExercise.rest_seconds)})`);
      }

      lines.push(parts.join(' '));

      if (userExercise.notes) {
        lines.push(`   Notes: ${userExercise.notes}`);
      }
      lines.push('');
    });
  });

  return lines.join('\n');
}

/**
 * Download a string as a file
 */
export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}