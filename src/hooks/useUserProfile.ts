import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!supabase || !user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, display_name, tier, subscription_status, subscription_ends_at, weight_unit')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      
      setProfile({
        ...data,
        weight_unit: data.weight_unit || 'lbs', // Default fallback
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch profile when user changes
  useEffect(() => {
    if (authLoading) {
      // Still determining auth state
      return;
    }

    if (!user) {
      // User is not logged in
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [user, authLoading, fetchProfile]);

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
    loading: loading || authLoading, 
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