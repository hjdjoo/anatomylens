/**
 * Exercise Library Modal
 * 
 * Displays the user's saved exercises organized by body region.
 * Supports inline editing of sets, reps, weight, rest, and notes.
 * Premium feature - requires tier 1+
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Modal } from '../../layout/Modal';
import { useLibraryModal } from '@/store/modalStore';
import { 
  useUserExercises, 
  type SavedExerciseWithDetails, 
  // type Exercise,
  type UserExerciseUpdate,
  parseRestTime,
  formatRestTime,
  generateExerciseCSV,
  generateExerciseText,
  downloadAsFile,
  copyToClipboard,
} from '@/hooks/useAnatomyData';
import { useUserProfile } from '@/hooks/useUserProfile';
import Premium from '../../ui/Premium';

// ============================================================
// CONSTANTS
// ============================================================

// Region display names and order
const REGION_CONFIG: Record<string, { label: string; order: number }> = {
  shoulder: { label: 'Shoulder', order: 0 },
  arm: { label: 'Arm', order: 1 },
  forearm: { label: 'Forearm', order: 2 },
  hand: { label: 'Hand', order: 3 },
  thorax: { label: 'Chest', order: 4 },
  abdomen: { label: 'Abdomen', order: 5 },
  back: { label: 'Back', order: 6 },
  pelvis: { label: 'Pelvis', order: 7 },
  hip_gluteal: { label: 'Hip', order: 8 },
  thigh: { label: 'Thigh', order: 9 },
  leg: { label: 'Lower Leg', order: 10 },
  foot: { label: 'Foot', order: 11 },
  neck: { label: 'Neck', order: 12 },
  face: { label: 'Face', order: 13 },
  other: { label: 'Other', order: 99 },
};

const DEBOUNCE_MS = 800;

function getRegionLabel(region: string): string {
  return REGION_CONFIG[region]?.label || region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getRegionOrder(region: string): number {
  return REGION_CONFIG[region]?.order ?? 50;
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" title={`Difficulty: ${level}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`w-1 h-2.5 rounded-sm ${n > level ? 'bg-accent-500' : 'bg-surface-700'}`}
        />
      ))}
    </div>
  );
}

// Saving indicator
function SavingIndicator({ saving }: { saving: boolean }) {
  if (!saving) return null;
  
  return (
    <div className="flex items-center gap-1 text-[10px] text-surface-500">
      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Saving...
    </div>
  );
}

// ============================================================
// INLINE INPUT COMPONENTS
// ============================================================

interface NumberInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  className?: string;
}

function NumberInput({ value, onChange, placeholder, min = 0, max = 999, className = '' }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value?.toString() ?? '');
  
  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value?.toString() ?? '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    
    if (raw === '') {
      onChange(null);
    } else {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= min && num <= max) {
        onChange(num);
      }
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={`
        w-14 px-2 py-1.5 text-center text-sm
        bg-surface-800 border border-surface-700 rounded-lg
        text-surface-200 placeholder-surface-600
        focus:outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500
        transition-colors
        ${className}
      `}
    />
  );
}

interface RestTimeInputProps {
  value: number | null; // seconds
  onChange: (value: number | null) => void;
  className?: string;
}

function RestTimeInput({ value, onChange, className = '' }: RestTimeInputProps) {
  const [localValue, setLocalValue] = useState(formatRestTime(value));
  const [isValid, setIsValid] = useState(true);
  
  // Sync with external value changes
  useEffect(() => {
    setLocalValue(formatRestTime(value));
    setIsValid(true);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    
    if (raw === '') {
      setIsValid(true);
      onChange(null);
    } else {
      const seconds = parseRestTime(raw);
      if (seconds !== null) {
        setIsValid(true);
        onChange(seconds);
      } else {
        setIsValid(false);
      }
    }
  };

  const handleBlur = () => {
    // On blur, format to standard mm:ss if valid
    if (value !== null) {
      setLocalValue(formatRestTime(value));
      setIsValid(true);
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0:00"
      className={`
        w-16 px-2 py-1.5 text-center text-sm
        bg-surface-800 border rounded-lg
        text-surface-200 placeholder-surface-600
        focus:outline-none focus:ring-1 focus:ring-accent-500/50
        transition-colors
        ${isValid ? 'border-surface-700 focus:border-accent-500' : 'border-red-500/50'}
        ${className}
      `}
    />
  );
}

interface NotesInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

function NotesInput({ value, onChange, className = '' }: NotesInputProps) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    // Limit to 500 characters for safety
    if (raw.length <= 500) {
      setLocalValue(raw);
      onChange(raw === '' ? null : raw);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={localValue}
      onChange={handleChange}
      placeholder="Add notes..."
      rows={1}
      className={`
        w-full px-3 py-2 text-sm resize-none
        bg-surface-800 border border-surface-700 rounded-lg
        text-surface-200 placeholder-surface-600
        focus:outline-none focus:ring-1 focus:ring-accent-500/50 focus:border-accent-500
        transition-colors
        ${className}
      `}
    />
  );
}

// ============================================================
// EDITABLE EXERCISE CARD
// ============================================================

interface EditableExerciseCardProps {
  item: SavedExerciseWithDetails;
  weightUnit: 'lbs' | 'kg' | string;
  onUpdate: (id: string, updates: UserExerciseUpdate) => void;
  onRemove: () => void;
  removing: boolean;
  saving: boolean;
}

function EditableExerciseCard({ 
  item, 
  weightUnit,
  onUpdate,
  onRemove,
  removing,
  saving,
}: EditableExerciseCardProps) {
  const { exercise, userExercise } = item;
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Debounced update handler
  // const handleFieldChange = useDebouncedCallback<(id: string, updates: UserExerciseUpdate) => void>(onUpdate, DEBOUNCE_MS)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleFieldChange = useCallback((field: keyof UserExerciseUpdate, value: unknown) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      onUpdate(userExercise.id, { [field]: value });
    }, DEBOUNCE_MS);
  }, [userExercise.id, onUpdate]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-surface-800/50 rounded-lg overflow-hidden">
      {/* Header row - always visible */}
      <div 
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/collapse icon */}
        <button 
          className="text-surface-500 hover:text-surface-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          <svg 
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Exercise name */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-surface-200 truncate">
            {exercise.name}
          </h4>
          {/* Quick summary when collapsed */}
          {!isExpanded && (userExercise.sets || userExercise.reps || userExercise.weight) && (
            <p className="text-[10px] text-surface-500 truncate">
              {[
                userExercise.sets && `${userExercise.sets}s`,
                userExercise.reps && `${userExercise.reps}r`,
                userExercise.weight && `${userExercise.weight}${weightUnit}`,
              ].filter(Boolean).join(' × ')}
            </p>
          )}
        </div>

        {/* Right side: difficulty + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SavingIndicator saving={saving} />
          <DifficultyDots level={exercise.difficulty} />
          
          {exercise.video_url && (
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-surface-500 hover:text-accent-400 transition-colors"
              title="Watch video"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={removing}
            className={`
              p-1.5 text-surface-600 hover:text-red-400 transition-colors
              ${removing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title="Remove from library"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded edit section */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-surface-700/50">
          {/* Sets / Reps / Weight / Rest row */}
          <div className="grid grid-cols-4 gap-2 pt-3">
            <div className="space-y-1">
              <label className="block text-[10px] text-surface-500 uppercase tracking-wide">Sets</label>
              <NumberInput
                value={userExercise.sets}
                onChange={(v) => handleFieldChange('sets', v)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-surface-500 uppercase tracking-wide">Reps</label>
              <NumberInput
                value={userExercise.reps}
                onChange={(v) => handleFieldChange('reps', v)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-surface-500 uppercase tracking-wide">
                Weight <span className="normal-case">({weightUnit})</span>
              </label>
              <NumberInput
                value={userExercise.weight}
                onChange={(v) => handleFieldChange('weight', v)}
                placeholder="—"
                max={9999}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] text-surface-500 uppercase tracking-wide">Rest</label>
              <RestTimeInput
                value={userExercise.rest_seconds}
                onChange={(v) => handleFieldChange('rest_seconds', v)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-[10px] text-surface-500 uppercase tracking-wide">Notes</label>
            <NotesInput
              value={userExercise.notes}
              onChange={(v) => handleFieldChange('notes', v)}
            />
          </div>

          {/* Equipment info */}
          {exercise.equipment && exercise.equipment.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              {exercise.equipment.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// REGION GROUP
// ============================================================

interface RegionGroupProps { 
  region: string;
  exercises: SavedExerciseWithDetails[];
  weightUnit: 'lbs' | 'kg' | string;
  onUpdate: (id: string, updates: UserExerciseUpdate) => void;
  onRemove: (exerciseId: string) => void;
  removingId: string | null;
  savingIds: Set<string>;
}

function RegionGroup({ 
  region, 
  exercises,
  weightUnit,
  onUpdate,
  onRemove,
  removingId,
  savingIds,
}: RegionGroupProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide flex items-center gap-2">
        {getRegionLabel(region)}
        <span className="text-surface-600 font-normal">({exercises.length})</span>
      </h3>
      <div className="space-y-1.5">
        {exercises.map((item) => (
          <EditableExerciseCard
            key={item.userExercise.id}
            item={item}
            weightUnit={weightUnit}
            onUpdate={onUpdate}
            onRemove={() => onRemove(item.exercise.id)}
            removing={removingId === item.exercise.id}
            saving={savingIds.has(item.userExercise.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// EXPORT MENU
// ============================================================

interface ExportMenuProps {
  exercises: SavedExerciseWithDetails[];
  weightUnit: 'lbs' | 'kg' | string;
}

function ExportMenu({ exercises, weightUnit }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleDownloadCSV = () => {
    const csv = generateExerciseCSV(exercises, weightUnit);
    const date = new Date().toISOString().split('T')[0];
    downloadAsFile(csv, `workout-${date}.csv`, 'text/csv');
    setIsOpen(false);
  };

  const handleCopyText = async () => {
    const text = generateExerciseText(exercises, weightUnit);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setIsOpen(false);
  };

  if (exercises.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded-lg transition-colors"
        title="Export workout"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-surface-900 rounded-lg border border-surface-700/50 shadow-xl overflow-hidden z-10">
          <button
            onClick={handleDownloadCSV}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download CSV
          </button>
          <button
            onClick={handleCopyText}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// WEIGHT UNIT TOGGLE
// ============================================================

interface WeightUnitToggleProps {
  value: 'lbs' | 'kg' | string;
  onChange: (unit: 'lbs' | 'kg') => void;
}

function WeightUnitToggle({ value, onChange }: WeightUnitToggleProps) {
  return (
    <div className="flex items-center gap-1 p-0.5 bg-surface-800/50 rounded-lg">
      <button
        onClick={() => onChange('lbs')}
        className={`
          px-2 py-1 text-xs font-medium rounded transition-all
          ${value === 'lbs'
            ? 'bg-surface-700 text-surface-100 shadow-sm'
            : 'text-surface-500 hover:text-surface-300'
          }
        `}
      >
        lbs
      </button>
      <button
        onClick={() => onChange('kg')}
        className={`
          px-2 py-1 text-xs font-medium rounded transition-all
          ${value === 'kg'
            ? 'bg-surface-700 text-surface-100 shadow-sm'
            : 'text-surface-500 hover:text-surface-300'
          }
        `}
      >
        kg
      </button>
    </div>
  );
}

// ============================================================
// MAIN MODAL COMPONENT
// ============================================================

export function ExerciseLibraryModal() {
  const { isOpen, close } = useLibraryModal();
  const { 
    savedExercises, 
    loading, 
    error, 
    hasTier, 
    toggleSave,
    isSaving,
    updateUserExercise,
    weightUnit,
  } = useUserExercises();

  const { setWeightUnit } = useUserProfile();
  const [tempWeightUnit, setTempWeightUnit] = useState<string | "lb" | "kg">(weightUnit || "lbs");
  const [removingId, setRemovingId] = useState<string | null>(null);
  
  // Track which exercises are currently saving
  const savingIds = useMemo(() => {
    const ids = new Set<string>();
    savedExercises.forEach(e => {
      if (isSaving(e.userExercise.id)) {
        ids.add(e.userExercise.id);
      }
    });
    return ids;
  }, [savedExercises, isSaving]);

  // Group exercises by region
  const groupedExercises = useMemo(() => {
    const groups: Record<string, SavedExerciseWithDetails[]> = {};
    
    savedExercises.forEach((item) => {
      const region = item.region || 'other';
      if (!groups[region]) {
        groups[region] = [];
      }
      groups[region].push(item);
    });

    // Sort regions and exercises within each region
    const sortedRegions = Object.keys(groups).sort(
      (a, b) => getRegionOrder(a) - getRegionOrder(b)
    );

    return sortedRegions.map((region) => ({
      region,
      exercises: groups[region].sort((a, b) => 
        a.exercise.name.localeCompare(b.exercise.name)
      ),
    }));
  }, [savedExercises]);

  const handleRemove = async (exerciseId: string) => {
    setRemovingId(exerciseId);
    try {
      await toggleSave(exerciseId);
    } catch (err) {
      console.error('Failed to remove exercise:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const handleUpdate = useCallback(async (userExerciseId: string, updates: UserExerciseUpdate) => {
    try {
      await updateUserExercise(userExerciseId, updates);
    } catch (err) {
      console.error('Failed to update exercise:', err);
      // Could show a toast here
    }
  }, [updateUserExercise]);

  const handleWeightUnitChange = useCallback(async (unit: 'lbs' | 'kg') => {
    setTempWeightUnit(unit);
    try {
      await setWeightUnit(unit);
    } catch (err) {
      console.error('Failed to update weight unit:', err);
      setTempWeightUnit(weightUnit);
    } 
  }, [setWeightUnit]);

  return (
    <Modal isOpen={isOpen} onClose={close} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-surface-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-600/20 rounded-lg">
                <svg className="w-5 h-5 text-accent-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-surface-100">
                  My Exercise Library
                </h2>
                <p className="text-sm text-surface-400">
                  {savedExercises.length} saved exercise{savedExercises.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Header actions */}
            {hasTier && savedExercises.length > 0 && (
              <div className="flex items-center gap-2">
                <WeightUnitToggle value={tempWeightUnit} onChange={handleWeightUnitChange} />
                <ExportMenu exercises={savedExercises} weightUnit={weightUnit} />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasTier ? (
            <Premium feature="Exercise Library" />
          ) : loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse">
                  <div className="h-4 bg-surface-700 rounded w-24 mb-2" />
                  <div className="h-16 bg-surface-800 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">Failed to load your library</p>
              <p className="text-surface-500 text-xs mt-1">Please try again later</p>
            </div>
          ) : savedExercises.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h3 className="text-surface-300 font-medium mb-1">No saved exercises yet</h3>
              <p className="text-surface-500 text-sm max-w-xs mx-auto">
                Click the bookmark icon on any exercise to add it to your library
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedExercises.map(({ region, exercises }) => (
                <RegionGroup
                  key={region}
                  region={region}
                  exercises={exercises}
                  weightUnit={tempWeightUnit}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  removingId={removingId}
                  savingIds={savingIds}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-700/50 bg-surface-900/50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-surface-600">
              Tap exercise to expand • Changes auto-save
            </p>
            <button
              onClick={close}
              className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ExerciseLibraryModal;
