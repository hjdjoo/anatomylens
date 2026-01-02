/**
 * MobileViewControls
 * 
 * Minimal floating controls for mobile viewports.
 * Shows a FAB that expands to reveal essential controls.
 * Auto-collapses when InfoPanel is open.
 */

import { useState, useEffect } from 'react';
import { useAnatomyStore } from '@/store';

// Depth labels (same as ViewControls)
const DEPTH_LABELS = [
  'All Layers',
  'Surface Hidden',
  'Deep Only',
  'Bones Only',
];

export function MobileViewControls() {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    peelDepth,
    peelDeeper,
    restoreLayer,
    resetPeel,
    manuallyPeeledIds,
    resetManualPeels,
    undoLastPeel,
    peelHistory,
    infoPanelOpen,
    searchQuery,
    setSearchQuery,
  } = useAnatomyStore();

  const manualPeelCount = manuallyPeeledIds.size;

  // Auto-collapse when InfoPanel opens
  useEffect(() => {
    if (infoPanelOpen) {
      setIsExpanded(false);
    }
  }, [infoPanelOpen]);

  // If InfoPanel is open, just show a minimal toggle
  if (infoPanelOpen) {
    return null; // Hide entirely when viewing structure details
  }

  return (
    <div className="fixed bottom-32 left-4 z-40">
      {/* Expanded Panel */}
      <div
        className={`
          absolute bottom-14 left-0 w-64
          bg-surface-900/95 backdrop-blur-xl rounded-xl 
          border border-surface-700/50 shadow-xl
          transition-all duration-200 ease-out origin-bottom-left
          ${isExpanded 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          }
        `}
      >
        {/* Search */}
        <div className="p-3 border-b border-surface-700/50">
          <div className="relative">
            <input
              type="text"
              placeholder="Find structure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 pl-9 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-500 hover:text-surface-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Depth Peeling */}
        <div className="p-3">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
            Depth Peel
          </div>
          
          {/* Peel buttons */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={restoreLayer}
              disabled={peelDepth === 0}
              className={`
                flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                flex items-center justify-center gap-1
                ${peelDepth === 0
                  ? 'bg-surface-800 text-surface-600 cursor-not-allowed'
                  : 'bg-surface-800 text-surface-200 hover:bg-surface-700 active:bg-surface-600'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add
            </button>
            <button
              onClick={peelDeeper}
              disabled={peelDepth === 3}
              className={`
                flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                flex items-center justify-center gap-1
                ${peelDepth === 3
                  ? 'bg-surface-800 text-surface-600 cursor-not-allowed'
                  : 'bg-accent-600 text-white hover:bg-accent-500 active:bg-accent-400'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              Peel
            </button>
          </div>

          {/* Depth indicator */}
          <div className="flex gap-1 mb-1">
            {[0, 1, 2, 3].map((level) => (
              <div
                key={level}
                className={`
                  flex-1 h-1.5 rounded-full transition-colors
                  ${level <= peelDepth ? 'bg-accent-500' : 'bg-surface-700'}
                `}
              />
            ))}
          </div>
          <div className="text-xs text-surface-400 text-center mb-2">
            {DEPTH_LABELS[peelDepth]}
          </div>

          {peelDepth > 0 && (
            <button
              onClick={resetPeel}
              className="w-full py-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              Reset to show all
            </button>
          )}
        </div>

        {/* Manual peels section */}
        {manualPeelCount > 0 && (
          <div className="px-3 pb-3 pt-0">
            <div className="pt-3 border-t border-surface-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-400">
                  {manualPeelCount} hidden
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={undoLastPeel}
                  disabled={peelHistory.length === 0}
                  className={`
                    flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all
                    flex items-center justify-center gap-1
                    ${peelHistory.length === 0
                      ? 'bg-surface-800 text-surface-600 cursor-not-allowed'
                      : 'bg-surface-800 text-surface-300 hover:bg-surface-700 active:bg-surface-600'
                    }
                  `}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Undo
                </button>
                <button
                  onClick={resetManualPeels}
                  className="flex-1 px-2 py-2 text-xs text-accent-400 hover:text-accent-300 hover:bg-accent-600/10 rounded-lg transition-all"
                >
                  Restore all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="px-3 pb-3">
          <p className="text-[10px] text-surface-500 text-center">
            Double-tap structures to hide
          </p>
        </div>
      </div>

      {/* Toggle FAB */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-200
          ${isExpanded
            ? 'bg-surface-700 text-surface-200 rotate-45'
            : 'bg-accent-600 text-white hover:bg-accent-500'
          }
        `}
        aria-label={isExpanded ? 'Close controls' : 'Open controls'}
      >
        {isExpanded ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        )}
      </button>

      {/* Badge for manual peels when collapsed */}
      {!isExpanded && manualPeelCount > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow">
          {manualPeelCount}
        </div>
      )}
    </div>
  );
}

export default MobileViewControls;
