/**
 * Create Checkout Session Edge Function
 * 
 * Creates a Stripe Checkout session for subscription signup.
 * Requires authenticated user.
 * 
 * POST /create-checkout-session
 * Headers: Authorization: Bearer <jwt>
 * Body: { successUrl?: string, cancelUrl?: string }
 * 
 * Returns: { url: string } - Stripe Checkout URL to redirect to
 */

import Stripe from 'npm:stripe'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin, getUser } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-12-15.clover',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_ID = Deno.env.get('STRIPE_PRICE_ID') ?? '';

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
    const {
      successUrl = `${req.headers.get('origin')}/home`,
      cancelUrl = `${req.headers.get('origin')}/home`,
    } = body;

    // Get or create Stripe customer
    const supabaseAdmin = createSupabaseAdmin();

    // Fetch user profile to check for existing stripe_customer_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
      return errorResponse('Failed to fetch user profile', 500);
    }

    let customerId = profile?.stripe_customer_id;

    // If no Stripe customer exists, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Store the customer ID in user_profiles
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating stripe_customer_id:', updateError);
        // Don't fail - we can still proceed with checkout
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
      // Allow promotion codes (optional, nice for launch)
      allow_promotion_codes: true,
    });

    return jsonResponse({ url: session.url });

  } catch (error) {
    console.error('Checkout session error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create checkout session',
      500
    );
  }
});
