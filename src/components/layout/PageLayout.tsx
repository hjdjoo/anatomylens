import { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function PageLayout({ children, title, subtitle }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-surface-900 via-surface-950 to-surface-950 -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-900/80 backdrop-blur-xl border-b border-surface-700/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to="/home"
            className="flex items-center gap-2 text-surface-100 hover:text-accent-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back to App</span>
          </Link>

          <Link
            to="/home"
            className="text-lg font-semibold text-surface-100"
          >
            AnatomyLens
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-100">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-surface-400">{subtitle}</p>
          )}
        </div>

        {/* Page content */}
        <div className="prose prose-invert prose-surface max-w-none">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-700/50 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-surface-500">
              © {new Date().getFullYear()} AnatomyLens. All rights reserved.
            </p>
            <nav className="flex items-center gap-6">
              <Link
                to="/about"
                className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
              >
                About
              </Link>
              <Link
                to="/terms"
                className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/privacy"
                className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
              >
                Privacy Policy
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PageLayout;