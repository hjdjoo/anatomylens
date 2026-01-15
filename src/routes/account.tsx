import { useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus, useManageSubscription } from '@/components/ui/SubscriptionStatus';
import { useLoginModal, useLibraryModal } from '@/store/modalStore';

export const Route = createFileRoute('/account')({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { open: openLogin } = useLoginModal();
  const { open: openLibrary } = useLibraryModal();

  const {
    loading: subLoading,
    isPremium,
    status,
    isActive,
    isCanceling,
    isPastDue,
    statusMessage,
    canManageSubscription,
  } = useSubscriptionStatus();

  const { openPortal, loading: portalLoading, error: portalError } = useManageSubscription();

  // Redirect non-authenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      openLogin();
      navigate({ to: '/' });
    }

  }, [authLoading, user, openLogin, navigate]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-surface-700" />
          <div className="absolute inset-0 rounded-full border-4 border-accent-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // Don't render if no user (redirect will happen)
  if (!user) {
    return null;
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-900 via-surface-950 to-surface-950" />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to AnatomyLens
        </Link>

        <h1 className="text-2xl font-bold text-surface-100 mb-8">My Account</h1>

        <div className="space-y-6">
          {/* Profile Section */}
          <section className="bg-surface-900/80 backdrop-blur-xl rounded-2xl border border-surface-700/50 p-6">
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-4">
              Profile
            </h2>

            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-16 h-16 rounded-full border-2 border-surface-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent-600 flex items-center justify-center text-white text-2xl font-semibold border-2 border-surface-700">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-surface-100 truncate">
                  {displayName}
                </h3>
                <p className="text-sm text-surface-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </section>

          {/* Subscription Section */}
          <section className="bg-surface-900/80 backdrop-blur-xl rounded-2xl border border-surface-700/50 p-6">
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-4">
              Subscription
            </h2>

            {subLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-surface-700 rounded w-32" />
                <div className="h-4 bg-surface-700 rounded w-48" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status badge */}
                <div className="flex items-center gap-3">
                  <StatusBadge
                    isPremium={isPremium}
                    status={status ?? null}
                    isActive={isActive}
                    isCanceling={isCanceling}
                    isPastDue={isPastDue}
                  />
                </div>

                {/* Status message (renewal date, cancellation date, etc.) */}
                {statusMessage && (
                  <p className="text-sm text-surface-400">
                    {statusMessage}
                  </p>
                )}

                {/* Past due warning */}
                {isPastDue && (
                  <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <p className="text-sm text-amber-300">
                      Your payment method needs to be updated to continue your subscription.
                    </p>
                  </div>
                )}

                {/* Portal error */}
                {portalError && (
                  <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                    <p className="text-sm text-red-300">{portalError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {canManageSubscription ? (
                    <button
                      onClick={() => openPortal()}
                      disabled={portalLoading}
                      className="px-4 py-2 bg-surface-800 hover:bg-surface-700 disabled:opacity-50 text-surface-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {portalLoading ? (
                        <>
                          <LoadingSpinner />
                          Opening...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Manage Subscription
                        </>
                      )}
                    </button>
                  ) : !isPremium ? (
                    <Link
                      to="/"
                      search={{ upgrade: true }}
                      className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      Upgrade to Premium
                    </Link>
                  ) : null}
                </div>

                {/* Plan details for premium users */}
                {isPremium && (
                  <div className="pt-4 border-t border-surface-700/50">
                    <h4 className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
                      Your Plan Includes
                    </h4>
                    <ul className="space-y-2 text-sm text-surface-300">
                      <li className="flex items-center gap-2">
                        <CheckIcon />
                        Exercises for every muscle group
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon />
                        Difficulty ratings & progressions
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon />
                        Clinical details & attachments
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon />
                        Personal exercise library
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Quick Actions Section */}
          <section className="bg-surface-900/80 backdrop-blur-xl rounded-2xl border border-surface-700/50 p-6">
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-4">
              Quick Actions
            </h2>

            <div className="space-y-2">
              {isPremium && (
                <button
                  onClick={openLibrary}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-surface-800/50 hover:bg-surface-800 rounded-xl text-left transition-colors group"
                >
                  <div className="p-2 bg-accent-600/20 rounded-lg group-hover:bg-accent-600/30 transition-colors">
                    <svg className="w-5 h-5 text-accent-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-surface-200">My Exercise Library</h3>
                    <p className="text-xs text-surface-500">View and manage your saved exercises</p>
                  </div>
                  <svg className="w-5 h-5 text-surface-600 group-hover:text-surface-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              <Link
                to="/"
                className="w-full flex items-center gap-3 px-4 py-3 bg-surface-800/50 hover:bg-surface-800 rounded-xl text-left transition-colors group"
              >
                <div className="p-2 bg-surface-700/50 rounded-lg group-hover:bg-surface-700 transition-colors">
                  <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-surface-200">Explore Anatomy</h3>
                  <p className="text-xs text-surface-500">Return to the 3D anatomy viewer</p>
                </div>
                <svg className="w-5 h-5 text-surface-600 group-hover:text-surface-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </section>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-surface-600 mt-8">
          Need help? Contact support@anatomylens.fit
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatusBadge({
  isPremium,
  // status,
  isActive,
  isCanceling,
  isPastDue,
}: {
  isPremium: boolean;
  status: string | null;
  isActive: boolean;
  isCanceling: boolean;
  isPastDue: boolean;
}) {
  if (isPastDue) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 text-amber-300 text-sm font-medium rounded-full">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        Payment Required
      </span>
    );
  }

  if (isCanceling) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-900/30 text-orange-300 text-sm font-medium rounded-full">
        <span className="w-2 h-2 rounded-full bg-orange-400" />
        Premium (Canceling)
      </span>
    );
  }

  if (isPremium && isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-300 text-sm font-medium rounded-full">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        Premium Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 text-surface-400 text-sm font-medium rounded-full">
      <span className="w-2 h-2 rounded-full bg-surface-500" />
      Free Plan
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default AccountPage;