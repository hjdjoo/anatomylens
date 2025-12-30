/**
 * Login Page Component
 * 
 * Provides Google OAuth and optional email/password authentication.
 * Styled to match the existing app theme (surface/accent colors).
 */

import { useState, FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

// ============================================================
// TYPES
// ============================================================

type AuthMode = 'login' | 'signup';

// ============================================================
// COMPONENT
// ============================================================

export function LoginPage() {
  const {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    clearError,
    isConfigured,
  } = useAuth();

  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  // If already authenticated, redirect to intended destination
  if (user) {
    return <Navigate to={from} replace />;
  }

  // Handle email form submission
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (mode === 'login') {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password);
    }
  };

  // Toggle between login and signup
  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    clearError();
  };

  // If Supabase is not configured, show a warning
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-900 rounded-2xl border border-surface-700/50 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-100 mb-2">
            Supabase Not Configured
          </h2>
          <p className="text-surface-400 text-sm">
            Please set <code className="text-accent-400">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-accent-400">VITE_SUPABASE_ANON_KEY</code> in your{' '}
            <code className="text-accent-400">.env</code> file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-accent-600/20 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-100">
            Anatomy Explorer
          </h1>
          <p className="text-surface-400 mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface-900/95 backdrop-blur-xl rounded-2xl border border-surface-700/50 shadow-2xl shadow-black/30 p-8">
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-300">{error.message}</p>
                  <button
                    onClick={clearError}
                    className="text-xs text-red-400 hover:text-red-300 mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <LoadingSpinner />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface-900 text-surface-500">
                or
              </span>
            </div>
          </div>

          {/* Email/Password Form Toggle */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full px-4 py-3 bg-surface-800 hover:bg-surface-700 text-surface-200 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Continue with Email
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-300 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all"
                  placeholder="you@example.com"
                />
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-surface-300 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <LoadingSpinner />}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              {/* Back to OAuth */}
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full text-sm text-surface-500 hover:text-surface-300 transition-colors"
              >
                ← Back to other options
              </button>
            </form>
          )}

          {/* Mode Toggle */}
          <div className="mt-6 text-center text-sm">
            <span className="text-surface-500">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </span>{' '}
            <button
              onClick={toggleMode}
              className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-surface-600">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-surface-500 hover:text-surface-400 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-surface-500 hover:text-surface-400 underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default LoginPage;
