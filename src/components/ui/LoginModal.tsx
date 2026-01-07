/**
 * Login Modal
 * 
 * Handles both sign in and sign up with email/password or Google OAuth.
 */

import { useState, FormEvent } from 'react';
import { Modal } from '../layout/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useLoginModal } from '@/store/modalStore';

type AuthMode = 'signin' | 'signup';

export function LoginModal() {
  const { isOpen, close } = useLoginModal();
  const {
    error,
    clearError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    isConfigured,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setLoading(false);
    setConfirmationSent(false);
    clearError();
  };

  const handleClose = () => {
    resetForm();
    setMode('signin');
    close();
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    clearError();
    setConfirmationSent(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signInWithGoogle();
    // Browser will redirect to Google, no need to handle success here
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();

    if (mode === 'signin') {
      const { error } = await signInWithEmail(email, password);
      setLoading(false);
      if (!error) {
        handleClose();
      }
    } else {
      const { error, needsConfirmation } = await signUpWithEmail(email, password);
      setLoading(false);
      if (!error) {
        if (needsConfirmation) {
          setConfirmationSent(true);
        } else {
          handleClose();
        }
      }
    }
  };

  if (!isConfigured) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-amber-900/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-100 mb-2">
            Configuration Required
          </h2>
          <p className="text-sm text-surface-400">
            Supabase environment variables are not set.
          </p>
        </div>
      </Modal>
    );
  }

  // Confirmation email sent state
  if (confirmationSent) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-green-900/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-100 mb-2">
            Check your email
          </h2>
          <p className="text-sm text-surface-400 mb-4">
            We sent a confirmation link to <span className="text-surface-200">{email}</span>
          </p>
          <p className="text-xs text-surface-500">
            Click the link in the email to complete your account setup.
          </p>
          <button
            onClick={handleClose}
            className="mt-6 px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-surface-100">
            {mode === 'signin' ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            {mode === 'signin'
              ? 'Sign in to access your account'
              : 'Get started with BodyGuide'
            }
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-sm text-red-300">{error.message}</p>
          </div>
        )}

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-800 font-medium rounded-xl transition-colors"
        >
          {loading ? (
            <LoadingSpinner className="text-gray-600" />
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
          <div className="relative flex justify-center">
            <span className="px-3 text-xs text-surface-500 bg-surface-900">or</span>
          </div>
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
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
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>

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
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-colors"
              placeholder="••••••••"
            />
            {mode === 'signup' && (
              <p className="mt-1 text-xs text-surface-500">At least 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <LoadingSpinner />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Mode toggle */}
        <p className="mt-6 text-center text-sm text-surface-400">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={toggleMode}
            className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </Modal>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default LoginModal;
