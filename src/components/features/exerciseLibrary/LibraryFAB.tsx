/**
 * Library FAB (Floating Action Button)
 * 
 * Quick access button to open the exercise library modal.
 * Only shows for premium users.
 */

import { useLibraryModal } from '@/store/modalStore';
import { useUserExercises } from '@/hooks/useAnatomyData';
import { useHasTier } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';

export function LibraryFAB() {
  const { open: openLibrary } = useLibraryModal();
  const { hasTier, loading: tierLoading } = useHasTier(1);
  const { savedExercises } = useUserExercises();
  const { user, isConfigured } = useAuth();

  // Don't show if not configured or not logged in
  if (!isConfigured || !user) return null;

  // Don't show while loading tier
  if (tierLoading) return null;

  // Don't show for non-premium users
  if (!hasTier) return null;

  const exerciseCount = savedExercises.length;

  return (
    <button
      onClick={openLibrary}
      className="fixed bottom-12 left-3 md:left-6 z-40 group"
      title="My Exercise Library"
    >
      <div className="relative">
        {/* Main button */}
        <div className="
          w-14 h-14 rounded-full
          bg-accent-600 hover:bg-accent-500
          shadow-lg shadow-accent-900/30 hover:shadow-accent-900/50
          flex items-center justify-center
          transition-all duration-200
          hover:scale-105 active:scale-95
        ">
          <svg 
            className="w-6 h-6 text-white" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>

        {/* Badge showing count */}
        {exerciseCount > 0 && (
          <div className="
            absolute -top-1 -right-1
            min-w-[20px] h-5 px-1.5
            bg-surface-100 text-surface-900
            text-xs font-bold
            rounded-full
            flex items-center justify-center
            shadow-sm
          ">
            {exerciseCount > 99 ? '99+' : exerciseCount}
          </div>
        )}

        {/* Tooltip */}
        <div className="
          absolute right-full mr-3 top-1/2 -translate-y-1/2
          px-3 py-1.5
          bg-surface-900 text-surface-200 text-sm
          rounded-lg
          whitespace-nowrap
          opacity-0 group-hover:opacity-100
          pointer-events-none
          transition-opacity
          shadow-lg
        ">
          My Library
          {exerciseCount > 0 && (
            <span className="text-surface-400 ml-1">({exerciseCount})</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default LibraryFAB;