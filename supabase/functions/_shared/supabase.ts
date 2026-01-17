/**
 * Supabase Admin Client for Edge Functions
 * 
 * Creates a Supabase client with service role privileges for database operations.
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type SupabaseAdmin = SupabaseClient;

/**
 * Create a Supabase admin client (service role)
 * Use this for database operations that bypass RLS
 */
export function createSupabaseAdmin(): SupabaseAdmin {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with the user's JWT
 * Use this to verify the user and get their ID
 */
export function createSupabaseClient(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const supabase = createSupabaseClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Log for debugging
  console.log('User ID:', user.id, 'Type:', typeof user.id);

  return user;
}
