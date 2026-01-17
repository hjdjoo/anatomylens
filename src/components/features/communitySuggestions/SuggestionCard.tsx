/**
 * SuggestionCard
 * 
 * Displays a community-suggested exercise with voting buttons.
 */

import { useState } from 'react';
import type { ExerciseSuggestion, SuggestionInvolvement } from '@/hooks/useExerciseSuggestions';

// ============================================================
// HELPER COMPONENTS
// ============================================================

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" title={`Difficulty: ${level}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`w-1.5 h-3 rounded-sm ${
            n <= level ? 'bg-accent-500' : 'bg-surface-700'
          }`}
        />
      ))}
    </div>
  );
}

function InvolvementBadge({ involvement }: { involvement: SuggestionInvolvement }) {
  const styles: Record<SuggestionInvolvement, string> = {
    primary: 'bg-green-900/30 text-green-300',
    secondary: 'bg-blue-900/30 text-blue-300',
    stabilizer: 'bg-purple-900/30 text-purple-300',
    stretched: 'bg-orange-900/30 text-orange-300',
  };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium ${styles[involvement]}`}>
      {involvement}
    </span>
  );
}

function VoteButton({ 
  direction, 
  active, 
  count,
  onClick,
  disabled,
}: { 
  direction: 'up' | 'down';
  active: boolean;
  count: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isUp = direction === 'up';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
        transition-all disabled:opacity-50 disabled:cursor-not-allowed
        ${active 
          ? isUp 
            ? 'bg-green-900/40 text-green-300' 
            : 'bg-red-900/40 text-red-300'
          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
        }
      `}
      title={isUp ? 'Upvote' : 'Downvote'}
    >
      <svg 
        className={`w-3.5 h-3.5 ${isUp ? '' : 'rotate-180'}`} 
        fill={active ? 'currentColor' : 'none'} 
        viewBox="0 0 24 24" 
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      <span>{count}</span>
    </button>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface SuggestionCardProps {
  suggestion: ExerciseSuggestion;
  onVote: (suggestionId: string, vote: 1 | -1) => void;
  isOwnSuggestion?: boolean;
}

export function SuggestionCard({ suggestion, onVote, isOwnSuggestion }: SuggestionCardProps) {
  const [voting, setVoting] = useState(false);

  const handleVote = async (vote: 1 | -1) => {
    if (voting || isOwnSuggestion) return;
    setVoting(true);
    try {
      await onVote(suggestion.id, vote);
    } finally {
      setVoting(false);
    }
  };

  const scorePercent = Math.round(suggestion.vote_ratio * 100);
  const totalVotes = suggestion.upvotes + suggestion.downvotes;

  return (
    <div className="bg-surface-800/30 rounded-lg p-3 space-y-2 border border-surface-700/30">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-surface-200 truncate">
              {suggestion.name}
            </h4>
            {/* Community badge */}
            <span className="px-1.5 py-0.5 bg-amber-900/30 text-amber-300 text-[9px] uppercase tracking-wide font-semibold rounded">
              Community
            </span>
          </div>
          {suggestion.equipment && suggestion.equipment.length > 0 && (
            <p className="text-[10px] text-surface-500 truncate">
              {suggestion.equipment.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <InvolvementBadge involvement={suggestion.involvement} />
          <DifficultyDots level={suggestion.difficulty} />
        </div>
      </div>

      {/* Description */}
      {suggestion.description && (
        <p className="text-xs text-surface-400 line-clamp-2">
          {suggestion.description}
        </p>
      )}

      {/* Footer: Voting + Meta */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Vote buttons */}
          <VoteButton
            direction="up"
            active={suggestion.user_vote === 1}
            count={suggestion.upvotes}
            onClick={() => handleVote(1)}
            disabled={voting || isOwnSuggestion}
          />
          <VoteButton
            direction="down"
            active={suggestion.user_vote === -1}
            count={suggestion.downvotes}
            onClick={() => handleVote(-1)}
            disabled={voting || isOwnSuggestion}
          />
          
          {/* Score indicator */}
          {totalVotes > 0 && (
            <span className={`
              text-[10px] font-medium
              ${scorePercent >= 70 ? 'text-green-400' : ''}
              ${scorePercent >= 40 && scorePercent < 70 ? 'text-surface-400' : ''}
              ${scorePercent < 40 ? 'text-red-400' : ''}
            `}>
              {scorePercent}% positive
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Video link */}
          {suggestion.video_url && (
            <a
              href={suggestion.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Video
            </a>
          )}
          
          {/* Contributor */}
          {suggestion.contributor_name && (
            <span className="text-[10px] text-surface-500">
              by {suggestion.contributor_name}
            </span>
          )}
        </div>
      </div>

      {/* Own suggestion indicator */}
      {isOwnSuggestion && (
        <p className="text-[10px] text-surface-500 italic">
          You suggested this exercise
        </p>
      )}
    </div>
  );
}

export default SuggestionCard;
