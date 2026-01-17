/**
 * Error Boundary Components
 * 
 * Catches JavaScript errors in child components and displays fallback UI.
 * Prevents white-screen crashes and provides recovery options.
 */

import { Component, ReactNode, ErrorInfo } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. Receives error and reset function. */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  /** Called when an error is caught. Use for logging/analytics. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Key to force reset when it changes (e.g., route change) */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================
// GENERIC ERROR BOUNDARY
// ============================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call optional error handler (for analytics/monitoring)
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when resetKey changes
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Custom fallback
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, this.resetError);
        }
        return fallback;
      }

      // Default fallback
      return <DefaultErrorFallback error={error} onRetry={this.resetError} />;
    }

    return children;
  }
}

// ============================================================
// DEFAULT FALLBACK UI
// ============================================================

interface DefaultErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps) {
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

  return (
    <div className="flex items-center justify-center min-h-[200px] p-6">
      <div className="max-w-md w-full bg-surface-900/95 backdrop-blur-xl rounded-2xl border border-surface-700/50 shadow-xl p-6 text-center">
        {/* Icon */}
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-900/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Message */}
        <h3 className="text-lg font-semibold text-surface-100 mb-2">
          Something went wrong
        </h3>
        <p className="text-sm text-surface-400 mb-4">
          An unexpected error occurred. Please try again.
        </p>

        {/* Error details (dev only) */}
        {isDev && (
          <details className="mb-4 text-left">
            <summary className="text-xs text-surface-500 cursor-pointer hover:text-surface-400">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-surface-800 rounded-lg text-xs text-red-300 overflow-x-auto">
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}

        {/* Retry button */}
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HOOK FOR ERROR REPORTING
// ============================================================

/**
 * Create an error handler for use with ErrorBoundary's onError prop.
 * Extend this to integrate with Sentry, LogRocket, etc.
 */
export function createErrorReporter(options?: {
  /** Additional context to include with errors */
  context?: Record<string, unknown>;
  /** Custom reporting function */
  reportFn?: (error: Error, info: ErrorInfo, context?: Record<string, unknown>) => void;
}) {
  return (error: Error, errorInfo: ErrorInfo) => {
    const { context, reportFn } = options ?? {};

    // Default: just log (extend this for production monitoring)
    console.error('[ErrorReporter]', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context,
      timestamp: new Date().toISOString(),
    });

    // Custom reporting (e.g., Sentry)
    reportFn?.(error, errorInfo, context);

    // Future: Sentry integration would look like:
    // Sentry.captureException(error, {
    //   extra: { componentStack: errorInfo.componentStack, ...context }
    // });
  };
}

export default ErrorBoundary;