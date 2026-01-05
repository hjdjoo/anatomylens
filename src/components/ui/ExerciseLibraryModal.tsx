/**
 * Exercise Library Modal
 * 
 * Displays the user's saved exercises organized by body region.
 * Premium feature - requires tier 1+
 */

import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useLibraryModal } from '@/store/modalStore';
import { useUserExercises, type SavedExerciseWithDetails, type Exercise } from '@/hooks/useAnatomyData';
import Premium from './Premium';

// Region display names and order
const REGION_CONFIG: Record<string, { label: string; order: number }> = {
  shoulder: { label: 'Shoulder', order: 0 },
  upper_arm: { label: 'Upper Arm', order: 1 },
  forearm: { label: 'Forearm', order: 2 },
  hand: { label: 'Hand', order: 3 },
  torso: { label: 'Torso', order: 4 },
  abdomen: { label: 'Abdomen', order: 5 },
  pelvis: { label: 'Pelvis', order: 6 },
  hip: { label: 'Hip', order: 7 },
  thigh: { label: 'Thigh', order: 8 },
  lower_leg: { label: 'Lower Leg', order: 9 },
  foot: { label: 'Foot', order: 10 },
  neck: { label: 'Neck', order: 11 },
  head: { label: 'Head', order: 12 },
  other: { label: 'Other', order: 99 },
};

function getRegionLabel(region: string): string {
  return REGION_CONFIG[region]?.label || region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getRegionOrder(region: string): number {
  return REGION_CONFIG[region]?.order ?? 50;
}

// Difficulty indicator (simplified version)
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

// Individual exercise card in the library
function LibraryExerciseCard({ 
  exercise, 
  onRemove,
  removing,
}: { 
  exercise: Exercise;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="bg-surface-800/50 rounded-lg p-3 flex items-center gap-3 group">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-surface-200 truncate">
          {exercise.name}
        </h4>
        {exercise.equipment && exercise.equipment.length > 0 && (
          <p className="text-[10px] text-surface-500 truncate">
            {exercise.equipment.join(', ')}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <DifficultyDots level={exercise.difficulty} />
        
        {exercise.video_url && (
          <a
            href={exercise.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-surface-500 hover:text-accent-400 transition-colors"
            title="Watch video"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </a>
        )}
        
        <button
          onClick={onRemove}
          disabled={removing}
          className={`
            p-1.5 text-surface-600 hover:text-red-400 transition-colors
            opacity-0 group-hover:opacity-100
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
  );
}

// Region group component
function RegionGroup({ 
  region, 
  exercises,
  onRemove,
  removingId,
}: { 
  region: string;
  exercises: SavedExerciseWithDetails[];
  onRemove: (exerciseId: string) => void;
  removingId: string | null;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide flex items-center gap-2">
        {getRegionLabel(region)}
        <span className="text-surface-600 font-normal">({exercises.length})</span>
      </h3>
      <div className="space-y-1.5">
        {exercises.map((item) => (
          <LibraryExerciseCard
            key={item.exercise.id}
            exercise={item.exercise}
            onRemove={() => onRemove(item.exercise.id)}
            removing={removingId === item.exercise.id}
          />
        ))}
      </div>
    </div>
  );
}

export function ExerciseLibraryModal() {
  const { isOpen, close } = useLibraryModal();
  const { savedExercises, loading, error, hasTier, toggleSave } = useUserExercises();
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  return (
    <Modal isOpen={isOpen} onClose={close} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-surface-700/50">
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
                  <div className="h-12 bg-surface-800 rounded" />
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
                  onRemove={handleRemove}
                  removingId={removingId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-700/50 bg-surface-900/50">
          <button
            onClick={close}
            className="w-full px-4 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ExerciseLibraryModal;