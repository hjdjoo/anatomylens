import { useAnatomyStore } from '@/store';
import torsoMetadata from "@/data/body_metadata.json"

// Type for metadata structure
interface StructureMetadata {
  meshId: string;
  originalName: string;
  type: string;
  layer: number;
  regions: string[];
  center: [number, number, number];
}

// Quick name formatter for mesh IDs
function formatName(meshId: string): { common: string; anatomical: string } {
  let clean = meshId
    .replace(/_[jio]$/, '')
    .replace(/_\d+$/, '')
    .replace(/_ol$/, '')
    .replace(/_or$/, '')
    .replace(/[()]/g, '');

  const words = clean.split('_').filter(Boolean);
  const titleCased = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return { common: titleCased, anatomical: titleCased };
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
  const metadata = JSON.parse(JSON.stringify(torsoMetadata)) as { structures: Record<string, StructureMetadata> };
  const structure = selectedStructureId ? metadata.structures[selectedStructureId] : null;
  const isManuallyPeeled = selectedStructureId ? manuallyPeeledIds.has(selectedStructureId) : false;

  // console.log(structure);

  if (!infoPanelOpen || !structure) return null;

  const names = formatName(selectedStructureId!);
  const displayName = viewMode === 'fitness' ? names.common : names.anatomical;

  return (
    <div className="absolute right-4 top-4 bottom-4 w-80 max-w-[calc(100vw-2rem)] overflow-hidden">
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
            <span className={`
              inline-block px-2 py-0.5 rounded text-xs uppercase tracking-wide font-medium
              ${structure.type === 'bone' ? 'bg-anatomy-bone/20 text-anatomy-bone' : ''}
              ${structure.type === 'muscle' ? 'bg-anatomy-muscle/20 text-red-300' : ''}
              ${structure.type === 'tendon' ? 'bg-anatomy-tendon/20 text-anatomy-tendon' : ''}
              ${structure.type === 'ligament' ? 'bg-amber-900/30 text-amber-300' : ''}
              ${structure.type === 'organ' ? 'bg-anatomy-organ/20 text-pink-300' : ''}
            `}>
              {structure.type}
            </span>

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
          {/* Regions */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
              Location
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {/* {structure.regions.map((region) => (
                <span
                  key={region}
                  className="px-2 py-1 text-xs bg-surface-800 text-surface-300 rounded-md capitalize"
                >
                  {region.replace(/_/g, ' ')}
                </span>
              ))} */}
            </div>
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
              {structure.layer > 3 && `Layer ${structure.layer}`}
            </p>
          </section>

          {/* Position */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
              Center Position
            </h3>
            <p className="text-xs text-surface-500 font-mono">
              x: {structure.center[0].toFixed(3)},
              y: {structure.center[1].toFixed(3)},
              z: {structure.center[2].toFixed(3)}
            </p>
          </section>

          {/* Placeholder for future content */}
          <section className="pt-4 border-t border-surface-800">
            <p className="text-xs text-surface-500 italic">
              Detailed descriptions, muscle attachments, and exercise information
              will be added as the content database grows.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}