import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useLoginModal } from '@/store/modalStore'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { user, loading } = useAuth()
  const { open } = useLoginModal()

  return (
    <div className="min-h-screen bg-surface-950 text-white overflow-x-hidden overflow-y-hidden">
      {/* Background layers */}
      <div className="fixed inset-0 bg-gradient-to-b from-surface-900 via-surface-950 to-black" />
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.15) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Subtle glow behind hero */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="AnatomyLens"
              className="w-8 h-8 md:w-10 md:h-10"
            />
            <span className="text-lg md:text-xl font-semibold tracking-tight">
              AnatomyLens
            </span>
          </div>

          <nav className="flex items-center gap-4 md:gap-6">
            <Link
              to="/about"
              className="text-sm text-surface-400 hover:text-white transition-colors"
            >
              About
            </Link>
            {!loading && (
              user ? (
                <Link
                  to="/home"
                  className="text-sm px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
                >
                  Open App
                </Link>
              ) : (
                <button
                  onClick={open}
                  className="text-sm text-surface-400 hover:text-white transition-colors"
                >
                  Sign In
                </button>
              )
            )}
          </nav>
        </header>

        {/* Hero Section */}
        <main className="relative px-6 md:px-12 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-12">
              {/* Left: Text content */}
              <div className="relative lg:grow-1 space-y-8 text-center lg:self-start lg:text-left mt-36 md:mt-36 pb-8 z-10">
                <div className="absolute inset-0 bg-gradient-to-t via-surface-950 from-surface-950 to-surface-950/90 rounded-3xl blur-xl -z-10" />
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                    Explore Human
                    <br />
                    <span className="bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                      Anatomy in 3D
                    </span>
                  </h1>
                  <p className="text-lg md:text-xl text-surface-400 max-w-lg mx-auto lg:mx-0">
                    Interactive anatomical visualization for students, fitness enthusiasts, and educators.
                  </p>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link
                    to="/home"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/20"
                  >
                    <span>Start Exploring</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    to="/about"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-surface-800/50 hover:bg-surface-800 text-surface-300 hover:text-white font-medium rounded-xl transition-all border border-surface-700/50"
                  >
                    Learn More
                  </Link>
                </div>
                {/* Feature highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <FeatureCard
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    }
                    title="838 Structures"
                    description="Comprehensive anatomical detail"
                  />
                  <FeatureCard
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    }
                    title="Exercise Library"
                    description="Muscle-targeted workouts"
                  />
                  <FeatureCard
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    }
                    title="Free to Use"
                    description="Premium from $1.99/mo"
                  />
                </div>
                {/* Floating badge */}
                <div className="w-full flex justify-center">
                  <div className="-bottom-4left-1/2 max-w-fit px-4 py-2 bg-surface-800/90 backdrop-blur-sm rounded-full border border-surface-700/50 shadow-xl">
                    <p className="text-xs text-surface-400 whitespace-nowrap">
                      Based on <span className="text-surface-300">Z-Anatomy</span> open-source dataset
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Hero image */}
              <div className="absolute w-full grow-0 flex justify-center lg:relative max-h-fit max-w-fit ">
                {/* Glow effect behind image */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary-500/10 via-transparent to-transparent rounded-3xl blur-2xl" />
                <div className="w-full flex flex-col max-w-sm lg:max-w-md xl:max-w-lg">
                  <img
                    src="/anatomylens_model.png"
                    alt="3D anatomical model preview"
                    className="drop-shadow-2xl"
                    loading="eager"
                  />
                </div>

              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 md:px-12 py-8 border-t border-surface-800/50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-surface-500">
            <p>© {new Date().getFullYear()} AnatomyLens. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/about" className="hover:text-surface-300 transition-colors">
                About
              </Link>
              <a href="#" className="hover:text-surface-300 transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-surface-300 transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-surface-900/50 rounded-xl border border-surface-800/50">
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
        {icon}
      </div>
      <div className="min-w-0 flex flex-col items-start text-left">
        <h3 className="font-medium text-white text-sm">{title}</h3>
        <p className="text-xs text-surface-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}