/**
 * Subscription Modal
 * 
 * Handles subscription flow via Stripe Checkout.
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { useSubscriptionModal } from '@/store/modalStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function SubscriptionModal() {
  const { isOpen, close } = useSubscriptionModal();
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!user || !session || !supabase) {
      setError('Please sign in to subscribe');
      return;
    }

    setLoading(true);
    setError(null);

    try {

      const jwt = (await supabase.auth.getSession()).data.session?.access_token

      if (!jwt) {
        throw new Error("No access token detected")
      }

      const {data: claimsData, error: claimsError} = await supabase.auth.getClaims(jwt);

      if (claimsError || !claimsData) {
        claimsError && console.error(claimsError.message)
        throw new Error("Couldn't verify JWT")
      }

      const response = await supabase.functions.invoke('create-checkout-session', {
        headers: {
          "Authorization": `Bearer ${jwt}`
        },
        body: {
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/?subscription=canceled`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create checkout session');
      }

      const { url } = response.data;

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} maxWidth="max-w-lg">
      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 bg-accent-600/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-100">
            Upgrade to Premium
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            Unlock the full exercise library
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Features list */}
        <div className="space-y-3 mb-6">
          <Feature icon="💪" text="Exercises for every muscle group" />
          <Feature icon="🎬" text="Video demonstrations" />
          <Feature icon="📊" text="Difficulty ratings & progressions" />
          <Feature icon="🔬" text="Clinical details & attachments" />
        </div>

        {/* Price */}
        <div className="text-center p-4 bg-surface-800/50 rounded-xl mb-6">
          <div className="text-3xl font-bold text-surface-100">
            $1.99<span className="text-lg font-normal text-surface-400">/month</span>
          </div>
          <p className="text-xs text-surface-500 mt-1">Cancel anytime</p>
        </div>

        {/* CTA */}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full px-4 py-3 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading && <LoadingSpinner />}
          {loading ? 'Redirecting to Checkout...' : 'Subscribe Now'}
        </button>

        <p className="mt-4 text-center text-xs text-surface-500">
          Secure payment powered by Stripe
        </p>
      </div>
    </Modal>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <span className="text-sm text-surface-300">{text}</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default SubscriptionModal;
