/**
 * Premium Upsell Component
 * 
 * Shows in InfoPanel when user doesn't have premium tier.
 * - Not logged in → Opens LoginModal
 * - Logged in, no premium → Opens SubscriptionModal
 */

import { useAuth } from '@/contexts/AuthContext';
import { useLoginModal, useSubscriptionModal } from '@/store/modalStore';

interface PremiumUpsellProps {
  feature?: string;
}

export function PremiumUpsell({ feature = 'Exercise Library' }: PremiumUpsellProps) {
  const { user } = useAuth();
  const { open: openLogin } = useLoginModal();
  const { open: openSubscription } = useSubscriptionModal();

  const handleClick = () => {
    if (!user) {
      openLogin();
    } else {
      openSubscription();
    }
  };

  return (
    <div className="bg-gradient-to-br from-accent-900/20 to-accent-800/10 rounded-lg p-4 border border-accent-700/30">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-accent-600/20 rounded-lg">
          <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-surface-100">
            Unlock {feature}
          </h4>
          <p className="text-xs text-surface-400 mt-1">
            {user
              ? 'Upgrade to Premium to access exercises and clinical details for every muscle with and create your own exercise library.'
              : 'Sign in to access premium features including exercises for every muscle and create your own exercise library.'
            }
          </p>
        </div>
      </div>
      <div className="flex justify-center">
        <button
          onClick={handleClick}
          className="mt-2 px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {user ? 'Upgrade to Premium' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}

export default PremiumUpsell;
