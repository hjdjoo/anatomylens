/**
 * Supabase client configuration
 * 
 * Environment variables required:
 *   VITE_SUPABASE_URL - Your Supabase project URL
 *   VITE_SUPABASE_ANON_KEY - Your Supabase anon/public key
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables not set.',
    '\nSet VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // Required for OAuth callback
    },
  })
  : null;
