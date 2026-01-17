import { createFileRoute } from '@tanstack/react-router';
import { PageLayout } from '@/components/layout/PageLayout';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageLayout
      title="About AnatomyLens"
      subtitle="Interactive 3D anatomy visualization for fitness and education"
    >
      {/* App Description Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-surface-100 mb-4">
          What is AnatomyLens?
        </h2>
        <div className="space-y-4 text-surface-300">
          <p>
            AnatomyLens is an interactive 3D anatomy visualization tool designed
            to help fitness enthusiasts, students, and educators explore the human body in a lightweight, intuitive interface.
          </p>
          <p>
            Whether you're learning which muscles are engaged during specific exercises,
            studying for an anatomy exam, or simply curious about how your body works,
            AnatomyLens provides a simple way to explore over 800 anatomical structures.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-surface-100 mb-4">
          Features
        </h2>
        <ul className="space-y-3 text-surface-300">
          <li className="flex items-start gap-3">
            <span className="text-accent-400 mt-1">•</span>
            <span>
              <strong className="text-surface-200">Interactive 3D Model</strong> —
              Rotate, zoom, and explore the human body from any angle
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-accent-400 mt-1">•</span>
            <span>
              <strong className="text-surface-200">Layer Peeling</strong> —
              Progressively reveal deeper structures from skin to bone
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-accent-400 mt-1">•</span>
            <span>
              <strong className="text-surface-200">Exercise Library</strong> —
              Discover exercises targeting specific muscles with difficulty ratings
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-accent-400 mt-1">•</span>
            <span>
              <strong className="text-surface-200">Clinical Details</strong> —
              Access muscle attachments, innervation, and anatomical terminology
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-accent-400 mt-1">•</span>
            <span>
              <strong className="text-surface-200">Personal Library</strong> —
              Save exercises and track your workout parameters
            </span>
          </li>
        </ul>
      </section>

      {/* Attribution Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-surface-100 mb-4">
          Anatomical Data Attribution
        </h2>
        <div className="bg-surface-800/50 rounded-xl p-6 border border-surface-700/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-surface-700/50 rounded-lg flex-shrink-0">
              <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-surface-100 mb-2">
                Z-Anatomy
              </h3>
              <p className="text-surface-300 mb-3">
                The 3D anatomical models used in AnatomyLens are derived from the
                <a
                  href="https://www.z-anatomy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-400 hover:text-accent-300 mx-1"
                >
                  Z-Anatomy
                </a>
                project — an open-source, collaborative platform for anatomical education.
              </p>
              <p className="text-surface-400 text-sm">
                Z-Anatomy provides freely available, high-quality anatomical models
                licensed under Creative Commons, enabling educational projects like
                AnatomyLens to make anatomy accessible to everyone.
              </p>
              <a
                href="https://www.z-anatomy.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm font-medium rounded-lg transition-colors"
              >
                Visit Z-Anatomy
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section (optional template) */}
      <section>
        <h2 className="text-xl font-semibold text-surface-100 mb-4">
          Contact
        </h2>
        <p className="text-surface-300">
          Have questions, feedback, or suggestions? We'd love to hear from you.
        </p>
        <p className="text-surface-400 mt-2">
          {/* TODO: Add contact email or form */}
          Contact information coming soon.
        </p>
      </section>
    </PageLayout>
  );
}

export default AboutPage;