/**
 * SuggestionForm
 * 
 * Form for creating new exercise suggestions.
 * Pre-fills the current structure as primary muscle.
 */

import { useState, useCallback } from 'react';
import { 
  useCreateSuggestion, 
  type SuggestionStructureMapping,
  type SuggestionInvolvement,
} from '@/hooks/useExerciseSuggestions';

// ============================================================
// TYPES
// ============================================================

interface SuggestionFormProps {
  /** Current mesh ID (pre-filled as primary) */
  meshId: string;
  /** Current structure name for display */
  structureName: string;
  /** Callback when suggestion is created */
  onSuccess?: () => void;
  /** Callback to close/cancel */
  onCancel?: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const INVOLVEMENT_OPTIONS: { value: SuggestionInvolvement; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'stabilizer', label: 'Stabilizer' },
  { value: 'stretched', label: 'Stretched' },
];

const COMMON_EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Kettlebell',
  'Cable Machine',
  'Resistance Band',
  'Bodyweight',
  'Pull-up Bar',
  'Bench',
  'Machine',
  'EZ Bar',
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function SuggestionForm({ 
  meshId, 
  structureName, 
  onSuccess, 
  onCancel 
}: SuggestionFormProps) {
  const { 
    createSuggestion, 
    loading, 
    error, 
    canSubmit, 
    remainingToday,
    clearError,
  } = useCreateSuggestion();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [customEquipment, setCustomEquipment] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [involvement, setInvolvement] = useState<SuggestionInvolvement>('primary');

  // Validation
  const isValid = name.trim().length >= 3 && name.trim().length <= 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !canSubmit || loading) return;

    clearError();

    const structures: SuggestionStructureMapping[] = [{
      mesh_id: meshId,
      involvement,
    }];

    const suggestionId = await createSuggestion({
      name: name.trim(),
      description: description.trim() || undefined,
      difficulty,
      equipment: equipment.length > 0 ? equipment : undefined,
      video_url: videoUrl.trim() || undefined,
      structures,
    });

    if (suggestionId) {
      // Reset form
      setName('');
      setDescription('');
      setDifficulty(3);
      setEquipment([]);
      setVideoUrl('');
      setInvolvement('primary');
      onSuccess?.();
    }
  };

  const toggleEquipment = (item: string) => {
    setEquipment(prev => 
      prev.includes(item) 
        ? prev.filter(e => e !== item)
        : [...prev, item]
    );
  };

  const addCustomEquipment = () => {
    const trimmed = customEquipment.trim();
    if (trimmed && !equipment.includes(trimmed)) {
      setEquipment(prev => [...prev, trimmed]);
      setCustomEquipment('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rate limit warning */}
      {!canSubmit && (
        <div className="p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg">
          <p className="text-xs text-amber-300">
            You've reached the daily limit of 5 suggestions. Try again tomorrow!
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-xs text-red-300">{error.message}</p>
        </div>
      )}

      {/* Exercise Name */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-surface-400">
          Exercise Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Incline Dumbbell Press"
          maxLength={100}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500"
        />
        <p className="text-[10px] text-surface-500">
          {name.length}/100 characters
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-surface-400">
          Description <span className="text-surface-500">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the exercise and tips..."
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500 resize-none"
        />
      </div>

      {/* Muscle Involvement */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-surface-400">
          How is <span className="text-accent-400">{structureName}</span> involved?
        </label>
        <div className="flex flex-wrap gap-1">
          {INVOLVEMENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setInvolvement(opt.value)}
              className={`
                px-2 py-1 text-xs font-medium rounded-lg transition-all
                ${involvement === opt.value
                  ? 'bg-accent-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-surface-400">
          Difficulty (1-5)
        </label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setDifficulty(n)}
              className={`
                w-8 h-8 rounded-lg text-sm font-medium transition-all
                ${difficulty === n
                  ? 'bg-accent-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                }
              `}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-surface-500 ml-2">
            {difficulty === 1 && 'Beginner'}
            {difficulty === 2 && 'Easy'}
            {difficulty === 3 && 'Intermediate'}
            {difficulty === 4 && 'Advanced'}
            {difficulty === 5 && 'Expert'}
          </span>
        </div>
      </div>

      {/* Equipment */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-surface-400">
          Equipment <span className="text-surface-500">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1">
          {COMMON_EQUIPMENT.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => toggleEquipment(item)}
              className={`
                px-2 py-1 text-[11px] font-medium rounded-md transition-all
                ${equipment.includes(item)
                  ? 'bg-accent-600/30 text-accent-300 border border-accent-600/50'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700 border border-transparent'
                }
              `}
            >
              {item}
            </button>
          ))}
        </div>
        
        {/* Custom equipment */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customEquipment}
            onChange={(e) => setCustomEquipment(e.target.value)}
            placeholder="Other equipment..."
            className="flex-1 px-2 py-1 bg-surface-800 border border-surface-700 rounded-lg text-xs text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-accent-500/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomEquipment();
              }
            }}
          />
          <button
            type="button"
            onClick={addCustomEquipment}
            disabled={!customEquipment.trim()}
            className="px-2 py-1 bg-surface-700 text-surface-300 text-xs rounded-lg hover:bg-surface-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        
        {/* Selected equipment display */}
        {equipment.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {equipment.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-700 text-surface-300 text-[10px] rounded"
              >
                {item}
                <button
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className="text-surface-500 hover:text-surface-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Video URL */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-surface-400">
          Video URL <span className="text-surface-500">(optional)</span>
        </label>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/..."
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-[10px] text-surface-500">
          {remainingToday} suggestion{remainingToday !== 1 ? 's' : ''} remaining today
        </p>
        
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!isValid || !canSubmit || loading}
            className="px-4 py-1.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Submit Suggestion
          </button>
        </div>
      </div>
    </form>
  );
}

export default SuggestionForm;
