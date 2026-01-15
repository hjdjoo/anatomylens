/**
 * User Menu Component
 * 
 * Header component showing sign in button, subscribe CTA, or user dropdown.
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLoginModal, useSubscriptionModal, useLibraryModal } from '@/store/modalStore';
import { Link } from '@tanstack/react-router';
import { useHasTier } from '@/hooks/useUserProfile';

export function UserMenu() {
  const { user, loading, signOut, isConfigured } = useAuth();
  const { open: openLogin } = useLoginModal();
  const { open: openSubscription } = useSubscriptionModal();
  const { open: openLibrary } = useLibraryModal();
  const { hasTier, loading: tierLoading } = useHasTier(1);

  const [isOpen, setIsOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render if Supabase not configured
  if (!isConfigured) return null;

  // Loading state
  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-surface-800 animate-pulse" />;
  }

  // Not logged in â†’ Sign In button
  if (!user) {
    return (
      <button
        onClick={openLogin}
        className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-surface-200 text-sm font-medium rounded-lg transition-colors"
      >
        Sign In
      </button>
    );
  }

  // Logged in but not premium â†’ Subscribe CTA + dropdown
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="flex items-center gap-3">
      {/* Subscribe CTA (only show if not premium) */}
      {!tierLoading && !hasTier && (
        <button
          onClick={openSubscription}
          className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span className="hidden sm:inline">Subscribe</span>
        </button>
      )}

      {/* User dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-800 transition-colors"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center text-white text-sm font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-surface-900 rounded-xl border border-surface-700/50 shadow-xl overflow-hidden z-50">
            {/* User info */}
            <div className="p-3 border-b border-surface-700/50">
              <p className="text-sm font-medium text-surface-100 truncate">{displayName}</p>
              <p className="text-xs text-surface-500 truncate">{user.email}</p>
              {hasTier && (
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-accent-600/20 text-accent-300 text-[10px] font-medium rounded uppercase">
                  Premium
                </span>
              )}
            </div>

            {/* Menu items */}
            <div className="p-1">
              {/* My Library (only show for premium users) */}
              {hasTier && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    openLibrary();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  My Library
                </button>
              )}
              {hasTier && (
                <button
                  onClick={() => {

                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h48v48H0z" fill="none" />
                    <g id="Shopicon">
                      <path fill="currentColor" d="M31.278,25.525C34.144,23.332,36,19.887,36,16c0-6.627-5.373-12-12-12c-6.627,0-12,5.373-12,12   c0,3.887,1.856,7.332,4.722,9.525C9.84,28.531,5,35.665,5,44h38C43,35.665,38.16,28.531,31.278,25.525z M16,16c0-4.411,3.589-8,8-8   s8,3.589,8,8c0,4.411-3.589,8-8,8S16,20.411,16,16z M24,28c6.977,0,12.856,5.107,14.525,12H9.475C11.144,33.107,17.023,28,24,28z" />
                    </g>
                  </svg>
                  <Link to="/account">
                    My Account
                  </Link>
                </button>
              )}

              {!hasTier && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    openSubscription();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-400 hover:bg-accent-900/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Upgrade to Premium
                </button>
              )}

              <button
                onClick={async () => {
                  setIsOpen(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserMenu;