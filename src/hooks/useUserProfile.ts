import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ============================================================
// USER PROFILE HOOK
// ============================================================

export type UserProfile = {
  id: string;
  display_name: string | null;
  tier: number;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  weight_unit: 'lbs' | 'kg' | string;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!user || userError) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, tier, subscription_status, subscription_ends_at, weight_unit')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile({
        ...data,
        weight_unit: data.weight_unit || 'lbs', // Default fallback
      });
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    fetchProfile();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Update weight unit preference
  const setWeightUnit = useCallback(async (unit: 'lbs' | 'kg') => {
    if (!supabase || !profile) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ weight_unit: unit })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, weight_unit: unit } : null);
    } catch (err) {
      console.error('Failed to update weight unit:', err);
      throw err;
    }
  }, [profile]);

  return { 
    profile, 
    loading, 
    error, 
    isAuthenticated: !!profile,
    setWeightUnit,
    refetch: fetchProfile,
  };
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