/**
 * CommunitySuggestions
 * 
 * Section component for InfoPanel that shows:
 * - Toggle between verified exercises and community suggestions
 * - Paginated list of top-voted suggestions
 * - Form to add new suggestions
 */

import { useState } from 'react';
import { useExerciseSuggestions } from '@/hooks/useExerciseSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionForm } from './SuggestionForm';

// ============================================================
// TYPES
// ============================================================

interface CommunitySuggestionsProps {
  meshId: string;
  structureName: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function CommunitySuggestions({ meshId, structureName }: CommunitySuggestionsProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  
  const {
    suggestions,
    loading,
    error,
    hasMore,
    hasTier,
    loadMore,
    vote,
    refetch,
  } = useExerciseSuggestions({ meshId });

  // Not premium - don't show this section
  if (!hasTier) {
    return null;
  }

  const handleSuggestionSuccess = () => {
    setShowForm(false);
    refetch();
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          Community Suggestions
        </h3>
        {suggestions.length > 0 && (
          <span className="text-[10px] text-surface-500">
            {suggestions.length}{hasMore ? '+' : ''} suggestion{suggestions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Suggestion Form Toggle */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-800/50 hover:bg-surface-800 border border-dashed border-surface-700 hover:border-surface-600 rounded-lg text-xs text-surface-400 hover:text-surface-200 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Suggest an Exercise
        </button>
      ) : (
        <div className="bg-surface-800/30 rounded-lg p-3 border border-surface-700/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-surface-300">New Suggestion</h4>
            <button
              onClick={() => setShowForm(false)}
              className="p-1 text-surface-500 hover:text-surface-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SuggestionForm
            meshId={meshId}
            structureName={structureName}
            onSuccess={handleSuggestionSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Loading state */}
      {loading && suggestions.length === 0 && (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="bg-surface-800/30 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-surface-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-xs text-red-300">Failed to load suggestions</p>
        </div>
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onVote={vote}
              isOwnSuggestion={suggestion.suggested_by === user?.id}
            />
          ))}
          
          {/* Load more button */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-2 text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                'Load more suggestions'
              )}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && suggestions.length === 0 && !showForm && (
        <div className="text-center py-4">
          <p className="text-xs text-surface-500">
            No community suggestions yet for this muscle.
          </p>
          <p className="text-[10px] text-surface-600 mt-1">
            Be the first to suggest an exercise!
          </p>
        </div>
      )}

      {/* Info footer */}
      <p className="text-[10px] text-surface-600 text-center">
        Community suggestions are reviewed and promoted based on votes
      </p>
    </section>
  );
}

export default CommunitySuggestions;
