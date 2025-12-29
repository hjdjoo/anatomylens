/**
 * React hooks for fetching anatomy-related data from Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
