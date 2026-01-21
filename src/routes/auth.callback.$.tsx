import { createFileRoute } from '@tanstack/react-router'

import { useEffect, useState } from 'react';
// import { useSearchParams } from 'react-router';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';


export const Route = createFileRoute('/auth/callback/$')({
  validateSearch: (search) => {
    return search
  },
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate();
  // const [searchParams] = useSearchParams();

  const searchParams = Route.useSearch()
  // console.log("auth/callback/searchParams: ", searchParams)
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        setError('Supabase not configured');
        return;
      }

      // Check for OAuth error
      const errorParam = searchParams['error'];
      if (errorParam) {
        setError(searchParams['error_description'] as string || JSON.stringify(errorParam));
        return;
      }

      try {
        // Supabase handles the token exchange automatically
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (session) {
          console.log('[AuthCallback] Logged in as:', session.user.email);
          // Redirect to home (or wherever the user came from)
          navigate({ from: "/auth/callback/$", to: "/home" });
        } else {
          // Session not ready yet, wait briefly
          setTimeout(() => navigate({ from: "/auth/callback/$", to: "/home" }), 500);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-900 rounded-2xl border border-surface-700/50 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-100 mb-2">
            Sign In Failed
          </h2>
          <p className="text-surface-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate({ from: "/auth/callback/$", to: "/" })}
            className="px-6 py-2.5 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl transition-all"
          >
            Back to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-surface-700" />
          <div className="absolute inset-0 rounded-full border-4 border-accent-500 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-surface-100 mb-2">
          Signing you in...
        </h2>
      </div>
    </div>
  );
}

export default AuthCallback
