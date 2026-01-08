import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================================
// TYPES
// ============================================================

export type SubscriptionStatus = 
  | 'active' 
  | 'canceling'    // Active but will cancel at period end
  | 'past_due' 
  | 'canceled' 
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'
  | null;

export type UserProfile = {
  id: string;
  display_name: string | null;
  tier: number;
  subscription_status: SubscriptionStatus;
  subscription_ends_at: string | null;    // When access ends (if canceled)
  subscription_renews_at: string | null;  // Next renewal date (if active)
  weight_unit: 'lbs' | 'kg' | string;
  stripe_customer_id: string | null;
}

// ============================================================
// HOOK
// ============================================================

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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id, 
          display_name, 
          tier, 
          subscription_status, 
          subscription_ends_at,
          subscription_renews_at,
          weight_unit,
          stripe_customer_id
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile({
        ...data,
        weight_unit: data.weight_unit || 'lbs',
        subscription_status: data.subscription_status as SubscriptionStatus,
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

// ============================================================
// SUBSCRIPTION STATUS HOOK
// ============================================================

export function useSubscriptionStatus() {
  const { profile, loading, refetch } = useUserProfile();

  const isPremium = (profile?.tier ?? 0) >= 1;
  const status = profile?.subscription_status;
  
  // Computed states
  const isActive = status === 'active';
  const isCanceling = status === 'canceling';
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled' || (!status && !isPremium);

  // Format dates for display
  const renewsAt = profile?.subscription_renews_at 
    ? new Date(profile.subscription_renews_at) 
    : null;
  const endsAt = profile?.subscription_ends_at 
    ? new Date(profile.subscription_ends_at) 
    : null;

  // Formatted strings
  const renewsAtFormatted = renewsAt 
    ? renewsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const endsAtFormatted = endsAt 
    ? endsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Status message for UI
  let statusMessage: string | null = null;
  if (isPastDue) {
    statusMessage = 'Payment failed. Please update your payment method.';
  } else if (isCanceling && endsAtFormatted) {
    statusMessage = `Your subscription will end on ${endsAtFormatted}`;
  } else if (isActive && renewsAtFormatted) {
    statusMessage = `Renews on ${renewsAtFormatted}`;
  }

  // Can user access Stripe portal?
  const canManageSubscription = !!profile?.stripe_customer_id;

  return {
    loading,
    isPremium,
    status,
    isActive,
    isCanceling,
    isPastDue,
    isCanceled,
    renewsAt,
    endsAt,
    renewsAtFormatted,
    endsAtFormatted,
    statusMessage,
    canManageSubscription,
    refetch,
  };
}

// ============================================================
// PORTAL SESSION HOOK
// ============================================================

export function useManageSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = useCallback(async (returnUrl?: string) => {
    if (!supabase) {
      setError('Not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('create-portal-session', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          returnUrl: returnUrl || window.location.href,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create portal session');
      }

      const { url } = response.data;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open subscription portal';
      setError(message);
      console.error('Portal error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { openPortal, loading, error };
}