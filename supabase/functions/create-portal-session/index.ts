/**
 * Create Portal Session Edge Function
 * 
 * Creates a Stripe Customer Portal session for users to manage their subscription.
 * Users can update payment methods, cancel subscription, view invoices, etc.
 * 
 * POST /create-portal-session
 * Headers: Authorization: Bearer <jwt>
 * Body: { returnUrl?: string }
 * 
 * Returns: { url: string } - Stripe Portal URL to redirect to
 */

import Stripe from 'npm:stripe';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin, getUser } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-12-15.clover',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication
    const user = await getUser(req);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { returnUrl = `${req.headers.get('origin')}/` } = body;

    // Get user's stripe_customer_id
    const supabaseAdmin = createSupabaseAdmin();
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return errorResponse('No subscription found. Please subscribe first.', 400);
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return jsonResponse({ url: session.url });

  } catch (error) {
    console.error('Portal session error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create portal session',
      500
    );
  }
});
