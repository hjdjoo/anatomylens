/**
 * useExerciseSuggestions
 * 
 * Hook for managing community exercise suggestions.
 * Handles fetching, creating, voting, and rate limiting.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useHasTier, useUserProfile } from './useUserProfile';

// ============================================================
// TYPES
// ============================================================

export type SuggestionInvolvement = 'primary' | 'secondary' | 'stabilizer' | 'stretched';

export interface ExerciseSuggestion {
  id: string;
  name: string;
  description: string | null;
  difficulty: number;
  equipment: string[];
  video_url: string | null;
  contributor_name: string | null;
  suggested_by: string;
  upvotes: number;
  downvotes: number;
  vote_ratio: number;
  user_vote: number | null; // 1, -1, or null
  involvement: SuggestionInvolvement;
  created_at: string;
}

export interface SuggestionStructureMapping {
  mesh_id: string;  // Use mesh_id, will be resolved to structure_id
  involvement: SuggestionInvolvement;
  notes?: string;
}

export interface CreateSuggestionInput {
  name: string;
  description?: string;
  difficulty: number;
  equipment?: string[];
  video_url?: string;
  structures: SuggestionStructureMapping[];
}

// ============================================================
// MAIN HOOK: useExerciseSuggestions
// ============================================================

interface UseExerciseSuggestionsOptions {
  /** The mesh_id from metadata (not the UUID) */
  meshId: string | null;
  pageSize?: number;
}

export function useExerciseSuggestions(options: UseExerciseSuggestionsOptions) {
  const { meshId, pageSize = 5 } = options;
  
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [structureId, setStructureId] = useState<string | null>(null);
  
  const { hasTier } = useHasTier(1);
  const { profile } = useUserProfile();

  // Resolve meshId to structureId (UUID)
  useEffect(() => {
    if (!supabase || !meshId) {
      setStructureId(null);
      return;
    }

    async function resolveStructureId() {
      const { data, error } = await supabase!
        .from('structures')
        .select('id')
        .eq('mesh_id', meshId!)
        .single();

      if (error) {
        // Structure might not be in DB yet
        if (error.code !== 'PGRST116') {
          console.error('Error resolving structure ID:', error);
        }
        setStructureId(null);
      } else {
        setStructureId(data.id);
      }
    }

    resolveStructureId();
  }, [meshId]);

  // Fetch suggestions for the current structure
  const fetchSuggestions = useCallback(async (reset = false) => {
    if (!supabase || !structureId || !hasTier) {
      setSuggestions([]);
      return;
    }

    const currentPage = reset ? 0 : page;
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSuggestions([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .rpc('get_structure_suggestions', {
          p_structure_id: structureId,
          p_user_id: user.id,
          p_limit: pageSize,
          p_offset: currentPage * pageSize,
        });

      if (fetchError) throw fetchError;

      const newSuggestions = (data || []) as ExerciseSuggestion[];
      
      if (reset) {
        setSuggestions(newSuggestions);
        setPage(0);
      } else {
        setSuggestions(prev => [...prev, ...newSuggestions]);
      }
      
      setHasMore(newSuggestions.length === pageSize);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch suggestions'));
    } finally {
      setLoading(false);
    }
  }, [structureId, hasTier, page, pageSize]);

  // Initial fetch when structure changes
  useEffect(() => {
    if (structureId) {
      fetchSuggestions(true);
    } else {
      setSuggestions([]);
    }
  }, [structureId, hasTier]);

  // Load more
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(p => p + 1);
      fetchSuggestions(false);
    }
  }, [loading, hasMore, fetchSuggestions]);

  // Vote on a suggestion
  const vote = useCallback(async (suggestionId: string, voteValue: 1 | -1) => {
    if (!supabase || !profile) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find current vote state
      const suggestion = suggestions.find(s => s.id === suggestionId);
      const currentVote = suggestion?.user_vote;

      if (currentVote === voteValue) {
        // Remove vote (clicking same button again)
        const { error: deleteError } = await supabase
          .from('suggestion_votes')
          .delete()
          .eq('user_id', user.id)
          .eq('suggestion_id', suggestionId);

        if (deleteError) throw deleteError;

        // Update local state
        setSuggestions(prev => prev.map(s => {
          if (s.id === suggestionId) {
            const newUpvotes = s.upvotes - (voteValue === 1 ? 1 : 0);
            const newDownvotes = s.downvotes - (voteValue === -1 ? 1 : 0);
            const total = newUpvotes + newDownvotes;
            return {
              ...s,
              upvotes: newUpvotes,
              downvotes: newDownvotes,
              vote_ratio: total > 0 ? newUpvotes / total : 0.5,
              user_vote: null,
            };
          }
          return s;
        }));
      } else {
        // Upsert vote
        const { error: upsertError } = await supabase
          .from('suggestion_votes')
          .upsert({
            user_id: user.id,
            suggestion_id: suggestionId,
            vote: voteValue,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,suggestion_id',
          });

        if (upsertError) throw upsertError;

        // Update local state
        setSuggestions(prev => prev.map(s => {
          if (s.id === suggestionId) {
            // Adjust counts based on previous vote
            let newUpvotes = s.upvotes;
            let newDownvotes = s.downvotes;
            
            // Remove old vote effect
            if (currentVote === 1) newUpvotes--;
            if (currentVote === -1) newDownvotes--;
            
            // Add new vote effect
            if (voteValue === 1) newUpvotes++;
            if (voteValue === -1) newDownvotes++;
            
            const total = newUpvotes + newDownvotes;
            return {
              ...s,
              upvotes: newUpvotes,
              downvotes: newDownvotes,
              vote_ratio: total > 0 ? newUpvotes / total : 0.5,
              user_vote: voteValue,
            };
          }
          return s;
        }));
      }
    } catch (err) {
      console.error('Error voting:', err);
      // Could show a toast here
    }
  }, [suggestions, profile]);

  return {
    suggestions,
    loading,
    error,
    hasMore,
    hasTier,
    loadMore,
    vote,
    refetch: () => fetchSuggestions(true),
  };
}

// ============================================================
// HOOK: useCreateSuggestion
// ============================================================

export function useCreateSuggestion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [canSubmit, setCanSubmit] = useState(true);
  const [remainingToday, setRemainingToday] = useState(5);
  
  const { hasTier } = useHasTier(1);
  const { profile } = useUserProfile();

  // Check rate limit on mount and after submissions
  const checkRateLimit = useCallback(async () => {
    if (!supabase || !profile) return;

    try {
      const { data, error } = await supabase
        .rpc('check_suggestion_rate_limit', { p_user_id: profile.id });

      if (error) throw error;
      
      setCanSubmit(data === true);
      
      // Get actual count for display
      const { count } = await supabase
        .from('exercise_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('suggested_by', profile.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      setRemainingToday(5 - (count || 0));
    } catch (err) {
      console.error('Error checking rate limit:', err);
    }
  }, [profile]);

  useEffect(() => {
    checkRateLimit();
  }, [checkRateLimit]);

  // Create a new suggestion
  const createSuggestion = useCallback(async (input: CreateSuggestionInput): Promise<string | null> => {
    if (!supabase || !profile || !hasTier) {
      setError(new Error('Not authorized'));
      return null;
    }

    if (!canSubmit) {
      setError(new Error('Daily suggestion limit reached (5 per day)'));
      return null;
    }

    if (input.structures.length === 0) {
      setError(new Error('At least one muscle mapping required'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Resolve mesh_ids to structure_ids
      const meshIds = input.structures.map(s => s.mesh_id);
      const { data: structureData, error: lookupError } = await supabase
        .from('structures')
        .select('id, mesh_id')
        .in('mesh_id', meshIds);

      if (lookupError) throw lookupError;

      const meshToUuid = new Map<string, string>();
      structureData?.forEach(s => meshToUuid.set(s.mesh_id, s.id));

      // Check all structures were found
      const missingMeshIds = meshIds.filter(id => !meshToUuid.has(id));
      if (missingMeshIds.length > 0) {
        throw new Error(`Structure(s) not found in database: ${missingMeshIds.join(', ')}`);
      }

      // Create the suggestion
      const { data: suggestion, error: insertError } = await supabase
        .from('exercise_suggestions')
        .insert({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          difficulty: input.difficulty,
          equipment: input.equipment || [],
          video_url: input.video_url?.trim() || null,
          suggested_by: profile.id,
          contributor_name: profile.display_name || 'Anonymous',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Create structure mappings using resolved UUIDs
      const structureMappings = input.structures.map(s => ({
        suggestion_id: suggestion.id,
        structure_id: meshToUuid.get(s.mesh_id)!,
        involvement: s.involvement,
        notes: s.notes || null,
      }));

      const { error: mappingError } = await supabase
        .from('suggestion_structures')
        .insert(structureMappings);

      if (mappingError) throw mappingError;

      // Update rate limit state
      await checkRateLimit();

      return suggestion.id;
    } catch (err) {
      console.error('Error creating suggestion:', err);
      setError(err instanceof Error ? err : new Error('Failed to create suggestion'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile, hasTier, canSubmit, checkRateLimit]);

  return {
    createSuggestion,
    loading,
    error,
    canSubmit,
    remainingToday,
    hasTier,
    clearError: () => setError(null),
  };
}

// ============================================================
// HOOK: useUserSuggestions (user's own suggestions)
// ============================================================

export interface UserSuggestion {
  id: string;
  name: string;
  status: 'pending' | 'rejected' | 'promoted';
  upvotes: number;
  downvotes: number;
  created_at: string;
  rejection_reason: string | null;
}

export function useUserSuggestions() {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { profile } = useUserProfile();

  useEffect(() => {
    if (!supabase || !profile) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await supabase!
          .from('exercise_suggestions')
          .select('id, name, status, upvotes, downvotes, created_at, rejection_reason')
          .eq('suggested_by', profile!.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSuggestions(data as UserSuggestion[]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch your suggestions'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [profile]);

  // Delete a pending suggestion
  const deleteSuggestion = useCallback(async (id: string) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('exercise_suggestions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting suggestion:', err);
    }
  }, []);

  return {
    suggestions,
    loading,
    error,
    deleteSuggestion,
  };
}
