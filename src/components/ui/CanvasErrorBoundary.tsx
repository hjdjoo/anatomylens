/**
 * Canvas Error Boundary
 * 
 * Specialized error boundary for Three.js/react-three-fiber content.
 * Provides 3D-specific error messages and graceful degradation.
 */

import { ErrorInfo, ReactNode } from 'react';
import { ErrorBoundary, createErrorReporter } from './ErrorBoundary';

// ============================================================
// TYPES
// ============================================================

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

// ============================================================
// 3D-SPECIFIC FALLBACK
// ============================================================

function Canvas3DFallback({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) {
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

  // Detect common WebGL/Three.js errors
  const isWebGLError = error.message.toLowerCase().includes('webgl') ||
    error.message.toLowerCase().includes('context');
  const isMemoryError = error.message.toLowerCase().includes('memory') ||
    error.message.toLowerCase().includes('allocation');
  const isShaderError = error.message.toLowerCase().includes('shader') ||
    error.message.toLowerCase().includes('glsl');

  let errorTitle = 'Unable to load 3D viewer';
  let errorMessage = 'There was a problem loading the anatomy model.';
  let suggestion = 'Please try refreshing the page.';

  if (isWebGLError) {
    errorTitle = 'WebGL not available';
    errorMessage = 'Your browser or device doesn\'t support WebGL, which is required for the 3D viewer.';
    suggestion = 'Try using a modern browser like Chrome, Firefox, or Edge.';
  } else if (isMemoryError) {
    errorTitle = 'Out of memory';
    errorMessage = 'The 3D model requires more memory than is currently available.';
    suggestion = 'Try closing other browser tabs or applications.';
  } else if (isShaderError) {
    errorTitle = 'Graphics error';
    errorMessage = 'There was a problem with the graphics rendering.';
    suggestion = 'Try updating your graphics drivers or using a different browser.';
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface-950 to-surface-900">
      <div className="max-w-lg w-full mx-4 bg-surface-900/95 backdrop-blur-xl rounded-2xl border border-surface-700/50 shadow-2xl p-8 text-center">
        {/* 3D Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-surface-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
            />
          </svg>
        </div>

        {/* Error Info */}
        <h3 className="text-xl font-semibold text-surface-100 mb-2">
          {errorTitle}
        </h3>
        <p className="text-sm text-surface-400 mb-2">
          {errorMessage}
        </p>
        <p className="text-sm text-surface-500 mb-6">
          {suggestion}
        </p>

        {/* Dev details */}
        {isDev && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-surface-500 cursor-pointer hover:text-surface-400">
              Technical details
            </summary>
            <pre className="mt-2 p-3 bg-surface-800 rounded-lg text-xs text-red-300 overflow-x-auto max-h-32">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium rounded-xl transition-colors"
          >
            Refresh Page
          </button>
        </div>

        {/* Feedback hint */}
        <p className="mt-6 text-xs text-surface-600">
          If this problem persists, please let us know using the feedback button.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// CANVAS ERROR BOUNDARY COMPONENT
// ============================================================

export function CanvasErrorBoundary({ children, onError }: CanvasErrorBoundaryProps) {
  // Create error reporter with 3D context
  const handleError = onError ?? createErrorReporter({
    context: { component: 'CanvasErrorBoundary', type: '3D' },
  });

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={(error, resetError) => (
        <Canvas3DFallback error={error} onRetry={resetError} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default CanvasErrorBoundary;