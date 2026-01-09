import { createFileRoute } from '@tanstack/react-router'
import { AnatomyCanvas } from '@/components/viewer';
import { InfoPanel, ResponsiveViewControls, InstructionsOverlay } from '@/components/ui';
import { ExerciseLibraryModal, LibraryFAB } from '@/components/features/exerciseLibrary'
import { Header } from '@/components/layout';

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="w-screen h-screen bg-surface-950 overflow-hidden relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-900 via-surface-950 to-surface-950" />
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
              linear-gradient(to right, rgb(255 255 255 / 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(255 255 255 / 0.1) 1px, transparent 1px)
            `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <AnatomyCanvas />
      </div>

      {/* UI Overlays */}
      <Header />
      <div>
        <ResponsiveViewControls />
        <LibraryFAB />
      </div>
      <InfoPanel />
      <ExerciseLibraryModal />

      {/* Instructions overlay for first-time users */}
      <InstructionsOverlay />
    </div>
  )
}