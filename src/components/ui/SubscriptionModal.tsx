/**
 * Subscription Modal (Stubbed)
 * 
 * Placeholder for subscription/payment flow.
 * TODO: Integrate with Stripe Checkout
 */

import { Modal } from './Modal';
import { useSubscriptionModal } from '@/store/modalStore';
import { useAuth } from '@/contexts/AuthContext';

export function SubscriptionModal() {
  const { isOpen, close } = useSubscriptionModal();
  const { user } = useAuth();

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
            $9<span className="text-lg font-normal text-surface-400">/month</span>
          </div>
          <p className="text-xs text-surface-500 mt-1">Cancel anytime</p>
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            // TODO: Implement Stripe checkout
            console.log('Open Stripe checkout for user:', user?.email);
            alert('Stripe checkout coming soon!');
          }}
          className="w-full px-4 py-3 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl transition-colors"
        >
          Subscribe Now
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

export default SubscriptionModal;
