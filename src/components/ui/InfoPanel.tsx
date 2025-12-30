import { useAnatomyStore } from '@/store';
import { useStructureExercises, useHasTier, type StructureExercise, ExerciseData } from '@/hooks/useAnatomyData';
import { isSupabaseConfigured } from '@/lib/supabase';
import torsoMetadata from "@/data/body_metadata.json";
import { useAuth } from '@/contexts/AuthContext';

// Type for metadata structure (V11 - bilateral mirroring)
interface StructureMetadata {
  meshId: string;
  originalName: string;
  baseName: string;
  type: string;
  layer: number;
  region: string;
  bilateral: boolean;
  center: [number, number, number];
  mirroredCenter?: [number, number, number];
}

interface MetadataFile {
  version: string;
  structures: Record<string, StructureMetadata>;
}

// Quick name formatter for mesh IDs
function formatName(meshId: string, baseName?: string): { common: string; anatomical: string } {
  // Use baseName if available (cleaner for bilateral structures)
  const source = baseName || meshId;

  let clean = source
    .replace(/_[jio]$/, '')
    .replace(/_\d+$/, '')
    .replace(/_ol$/, '')
    .replace(/_or$/, '')
    .replace(/_[lr]$/, '')  // Remove side suffix
    .replace(/[()]/g, '');

  const words = clean.split('_').filter(Boolean);
  const titleCased = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return { common: titleCased, anatomical: titleCased };
}

// Difficulty indicator component
function DifficultyIndicator({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" title={`Difficulty: ${level}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`w-1.5 h-3 rounded-sm ${n <= level ? 'bg-accent-500' : 'bg-surface-700'
            }`}
        />
      ))}
    </div>
  );
}

// Involvement badge component
function InvolvementBadge({ involvement }: { involvement: StructureExercise['involvement'] }) {
  const styles = {
    primary: 'bg-green-900/30 text-green-300',
    secondary: 'bg-blue-900/30 text-blue-300',
    stabilizer: 'bg-purple-900/30 text-purple-300',
    stretched: 'bg-orange-900/30 text-orange-300',
  } as { [state: string]: string };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium ${styles[involvement]}`}>
      {involvement}
    </span>
  );
}

// Exercise card component
function ExerciseCard({ structureExercise }: { structureExercise: ExerciseData }) {
  const { exercise, involvement, notes } = structureExercise;

  return (
    <div className="bg-surface-800/50 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <InvolvementBadge involvement={involvement} />
          <DifficultyIndicator level={exercise.difficulty} />
        </div>
      </div>

      {exercise.description && (
        <p className="text-xs text-surface-400 line-clamp-2">
          {exercise.description}
        </p>
      )}

      {notes && (
        <p className="text-xs text-surface-500 italic">
          {notes}
        </p>
      )}

      {exercise.video_url && (
        <a
          href={exercise.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Watch video
        </a>
      )}
    </div>
  );
}

// Premium upsell component
function PremiumUpsell() {
  const { user, loading, signInWithGoogle } = useAuth();

  const handleUpgradeClick = async () => {
    if (!user) {
      // Not logged in → trigger Google OAuth
      await signInWithGoogle();
    } else {
      // Logged in but no premium → subscription flow
      // TODO: Implement Stripe checkout
      console.log('Open subscription modal');
    }
  };



  return (
    <div className="bg-gradient-to-br from-accent-900/20 to-accent-800/10 rounded-lg p-4 border border-accent-700/30">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-accent-600/20 rounded-lg">
          <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-surface-100">
            Unlock Exercise Library
          </h4>
          <p className="text-xs text-surface-400 mt-1">
            {user
              ? 'Upgrade to access exercises for every muscle, with video demonstrations.'
              : 'Sign in for more in-depth information'
            }
          </p>
          <button
            className="mt-3 px-3 py-1.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2"
            onClick={handleUpgradeClick}
            disabled={loading}
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : user ? (
              'Upgrade to Premium'
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Exercises section component
function ExercisesSection({ meshId }: { meshId: string }) {
  const { exercises, loading, error, hasTier } = useStructureExercises(meshId);

  // Not configured - show nothing
  if (!isSupabaseConfigured) {
    return null;
  }

  // Show upsell if user doesn't have tier 1
  if (!hasTier) {
    return (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
          Exercises
        </h3>
        <PremiumUpsell />
      </section>
    );
  }

  // Loading state
  if (loading) {
    return (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
          Exercises
        </h3>
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="bg-surface-800/50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-surface-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
          Exercises
        </h3>
        <p className="text-xs text-red-400">
          Failed to load exercises. Please try again.
        </p>
      </section>
    );
  }

  // No exercises available
  if (exercises.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
          Exercises
        </h3>
        <p className="text-xs text-surface-500 italic">
          No exercises linked to this structure yet.
        </p>
      </section>
    );
  }

  // Group by involvement
  const primary = exercises.filter(e => e.involvement === 'primary');
  const secondary = exercises.filter(e => e.involvement === 'secondary');
  const other = exercises.filter(e => !['primary', 'secondary'].includes(e.involvement));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
          Exercises
        </h3>
        <span className="text-[10px] text-surface-500">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {primary.length > 0 && (
          <>
            {primary.map((se) => (
              <ExerciseCard key={se.exercise.id} structureExercise={se} />
            ))}
          </>
        )}

        {secondary.length > 0 && (
          <>
            {secondary.map((se) => (
              <ExerciseCard key={se.exercise.id} structureExercise={se} />
            ))}
          </>
        )}

        {other.length > 0 && (
          <>
            {other.map((se) => (
              <ExerciseCard key={se.exercise.id} structureExercise={se} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Information panel that displays details about the selected structure.
 * Shows different content based on the current view mode (fitness vs clinical).
 */
export function InfoPanel() {
  const {
    selectedStructureId,
    viewMode,
    infoPanelOpen,
    setInfoPanelOpen,
    setSelectedStructure,
    toggleManualPeel,
    manuallyPeeledIds,
  } = useAnatomyStore();

  // Get structure from metadata
  const metadata = JSON.parse(JSON.stringify(torsoMetadata)) as MetadataFile;
  const structure = selectedStructureId ? metadata.structures[selectedStructureId] : null;
  const isManuallyPeeled = selectedStructureId ? manuallyPeeledIds.has(selectedStructureId) : false;

  if (!infoPanelOpen || !structure) return null;

  const names = formatName(selectedStructureId!, structure.baseName);
  const displayName = viewMode === 'fitness' ? names.common : names.anatomical;

  // Only show exercises section for muscle-type structures
  const showExercises = ['muscle', 'tendon'].includes(structure.type);

  return (
    <div className="absolute right-4 top-24 bottom-12 w-80 max-w-[calc(100vw-2rem)] overflow-hidden">
      <div className="h-full bg-surface-900/95 backdrop-blur-xl rounded-2xl border border-surface-700/50 shadow-2xl shadow-black/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-surface-700/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-surface-100 truncate">
                {displayName}
              </h2>
              <p className="text-sm text-surface-400 truncate">
                {structure.originalName}
              </p>
            </div>
            <button
              onClick={() => {
                setInfoPanelOpen(false);
                setSelectedStructure(null);
              }}
              className="p-1.5 rounded-lg hover:bg-surface-800 transition-colors text-surface-400 hover:text-surface-200"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Type badge and Peel button */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className={`
                inline-block px-2 py-0.5 rounded text-xs uppercase tracking-wide font-medium
                ${structure.type === 'bone' ? 'bg-anatomy-bone/20 text-anatomy-bone' : ''}
                ${structure.type === 'muscle' ? 'bg-anatomy-muscle/20 text-red-300' : ''}
                ${structure.type === 'tendon' ? 'bg-anatomy-tendon/20 text-anatomy-tendon' : ''}
                ${structure.type === 'ligament' ? 'bg-amber-900/30 text-amber-300' : ''}
                ${structure.type === 'organ' ? 'bg-anatomy-organ/20 text-pink-300' : ''}
                ${structure.type === 'cartilage' ? 'bg-teal-900/30 text-teal-300' : ''}
                ${structure.type === 'fascia' ? 'bg-pink-900/30 text-pink-300' : ''}
                ${structure.type === 'bursa' ? 'bg-amber-800/30 text-amber-200' : ''}
                ${structure.type === 'capsule' ? 'bg-slate-700/30 text-slate-300' : ''}
                ${structure.type === 'membrane' ? 'bg-emerald-900/30 text-emerald-300' : ''}
              `}>
                {structure.type}
              </span>

              {/* Bilateral indicator */}
              {structure.bilateral && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium bg-indigo-900/30 text-indigo-300">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Bilateral
                </span>
              )}
            </div>

            <button
              onClick={() => {
                if (selectedStructureId) {
                  toggleManualPeel(selectedStructureId);
                  // Close panel after peeling since structure will be hidden
                  if (!isManuallyPeeled) {
                    setInfoPanelOpen(false);
                    setSelectedStructure(null);
                  }
                }
              }}
              className={`
                px-3 py-1 rounded-lg text-xs font-medium transition-all
                flex items-center gap-1.5
                ${isManuallyPeeled
                  ? 'bg-accent-600/20 text-accent-300 hover:bg-accent-600/30'
                  : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                }
              `}
            >
              {isManuallyPeeled ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Restore
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Peel Away
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Region */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
              Region
            </h3>
            <span className="px-2 py-1 text-xs bg-surface-800 text-surface-300 rounded-md capitalize inline-block">
              {structure.region.replace(/_/g, ' ')}
            </span>
          </section>

          {/* Layer info */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
              Depth Layer
            </h3>
            <p className="text-sm text-surface-300">
              {structure.layer === 0 && 'Deep (innermost)'}
              {structure.layer === 1 && 'Deep intermediate'}
              {structure.layer === 2 && 'Intermediate'}
              {structure.layer === 3 && 'Superficial (outermost)'}
              {structure.layer === 4 && 'Surface fascia'}
              {structure.layer > 4 && `Layer ${structure.layer}`}
            </p>
          </section>

          {/* Exercises section (only for muscles/tendons) */}
          {showExercises && (
            <div className="pt-4 border-t border-surface-800">
              <ExercisesSection meshId={selectedStructureId!} />
            </div>
          )}

          {/* Position (debug info, could be hidden in production) */}
          <section className="space-y-2 pt-4 border-t border-surface-800">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
              Center Position
            </h3>
            <p className="text-xs text-surface-500 font-mono">
              x: {structure.center[0].toFixed(3)},
              y: {structure.center[1].toFixed(3)},
              z: {structure.center[2].toFixed(3)}
            </p>
            {structure.bilateral && structure.mirroredCenter && (
              <p className="text-xs text-surface-600 font-mono">
                mirrored: x: {structure.mirroredCenter[0].toFixed(3)},
                y: {structure.mirroredCenter[1].toFixed(3)},
                z: {structure.mirroredCenter[2].toFixed(3)}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}