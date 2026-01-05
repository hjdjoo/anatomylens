/**
 * React hooks for fetching anatomy-related data from Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

import { Tables } from 'database.types';

// ============================================================
// TYPES
// ============================================================

export type Exercise = Tables<"exercises">

export type StructureExercise = Tables<"structure_exercises">

export type UserProfile = {
  id: string;
  display_name: string | null;
  tier: number;
  subscription_status: string | null;
  subscription_ends_at: string | null;
}

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
// USER PROFILE HOOK
// ============================================================

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      if (!supabase) {
          setLoading(false);
          return;
        }
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, display_name, tier, subscription_status, subscription_ends_at')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { profile, loading, error, isAuthenticated: !!profile };
}

// ============================================================
// TIER CHECK HOOK
// ============================================================

export function useHasTier(requiredTier: number) {
  const { profile, loading } = useUserProfile();

  return {
    hasTier: profile ? profile.tier >= requiredTier : false,
    loading,
    currentTier: profile?.tier ?? 0,
  };
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
    if (!supabase || !meshId || !enabled) {
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
  added_at: string | null;
}

export type SavedExerciseWithDetails = {
  userExercise: UserExercise;
  exercise: Exercise;
  region: string | null; // From structure for grouping
}

// ============================================================
// USER EXERCISE LIBRARY HOOK
// ============================================================

export function useUserExercises() {
  const [savedExercises, setSavedExercises] = useState<SavedExerciseWithDetails[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { hasTier } = useHasTier(1);

  // Fetch all saved exercises for the user
  const fetchSavedExercises = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSavedExercises([]);
        setSavedIds(new Set());
        setLoading(false);
        return;
      }

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
        .eq('user_id', user.id)
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
          structureData.forEach((se: any) => {
            if (se.structure?.region && !regionMap[se.exercise_id]) {
              regionMap[se.exercise_id] = se.structure.region;
            }
          });
        }
      }

      // Transform data
      const transformed: SavedExerciseWithDetails[] = (data || [])
        .filter((row: any) => row.exercise)
        .map((row: any) => ({
          userExercise: {
            id: row.id,
            user_id: row.user_id,
            exercise_id: row.exercise_id,
            notes: row.notes,
            sets: row.sets,
            reps: row.reps,
            added_at: row.added_at,
          },
          exercise: row.exercise as Exercise,
          region: regionMap[row.exercise_id] || 'other',
        }));

      setSavedExercises(transformed);
      setSavedIds(new Set(transformed.map(e => e.exercise.id)));
    } catch (err) {
      console.error('Error fetching saved exercises:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch library'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auth state listener
  useEffect(() => {
    if (!supabase) return;

    fetchSavedExercises();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSavedExercises();
    });

    return () => subscription.unsubscribe();
  }, [fetchSavedExercises]);

  // Toggle save/unsave an exercise
  const toggleSave = useCallback(async (exerciseId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const isCurrentlySaved = savedIds.has(exerciseId);

      if (isCurrentlySaved) {
        // Remove from library
        const { error: deleteError } = await supabase
          .from('user_exercises')
          .delete()
          .eq('user_id', user.id)
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
            user_id: user.id,
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
  }, [savedIds, fetchSavedExercises]);

  // Check if a specific exercise is saved
  const isSaved = useCallback((exerciseId: string): boolean => {
    return savedIds.has(exerciseId);
  }, [savedIds]);

  return {
    savedExercises,
    savedIds,
    loading,
    error,
    hasTier,
    toggleSave,
    isSaved,
    refetch: fetchSavedExercises,
  };
}