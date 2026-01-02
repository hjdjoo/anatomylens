/**
 * Stripe Webhook Handler Edge Function
 * 
 * Processes Stripe webhook events to keep user_profiles in sync with subscriptions.
 * 
 * POST /stripe-webhook
 * Headers: stripe-signature: <signature>
 * Body: Raw Stripe event payload
 * 
 * Events handled:
 * - checkout.session.completed: Initial subscription created
 * - customer.subscription.created: Subscription activated
 * - customer.subscription.updated: Status/period changes
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.payment_failed: Payment issue
 * - invoice.payment_succeeded: Payment recovered
 */

import Stripe from 'npm:stripe';
import { createSupabaseAdmin } from '../_shared/supabase.ts';
// import { Buffer } from "node:buffer";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Extract subscription ID from invoice.subscription field
 * In newer API versions, this can be string | Stripe.Subscription | null
 */
function getSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null;
  if (typeof subscription === 'string') return subscription;
  return subscription.id;
}

/**
 * Extract customer ID from customer field
 * Can be string | Stripe.Customer | Stripe.DeletedCustomer | null
 */
function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id;
}

/**
 * Get Supabase user ID from Stripe customer
 */
async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const supabaseAdmin = createSupabaseAdmin();
  
  // First check our database
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile?.id) {
    return profile.id;
  }

  // Fallback: check Stripe customer metadata
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.supabase_user_id) {
      return customer.metadata.supabase_user_id;
    }
  } catch (error) {
    console.error('Error fetching customer from Stripe:', error);
  }

  return null;
}

/**
 * Update user subscription status in database
 */
async function updateUserSubscription(
  userId: string,
  updates: {
    tier?: number;
    subscription_status?: string;
    subscription_id?: string | null;
    subscription_ends_at?: string | null;
    stripe_customer_id?: string;
  }
) {
  const supabaseAdmin = createSupabaseAdmin();
  
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }

  console.log(`Updated user ${userId}:`, updates);
}

/**
 * Convert Unix timestamp to ISO string
 */
function unixToIso(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Handle checkout.session.completed
 * User just finished checkout - subscription is being created
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id);

  const customerId = getCustomerId(session.customer);
  const subscriptionId = getSubscriptionId(session.subscription);

  if (!customerId || !subscriptionId) {
    console.error('Missing customer or subscription ID in checkout session:', session.id);
    return;
  }

  // Get user ID from metadata or customer lookup
  let userId = session.metadata?.supabase_user_id;
  
  if (!userId) {
    userId = await getUserIdFromCustomer(customerId) ?? undefined;
  }

  if (!userId) {
    console.error('Could not find user for checkout session:', session.id);
    return;
  }

  // Fetch the subscription to get status
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await updateUserSubscription(userId, {
    tier: 1,
    subscription_status: subscription.status,
    subscription_id: subscriptionId,
    subscription_ends_at: unixToIso(subscription.cancel_at),
    stripe_customer_id: customerId,
  });
}

/**
 * Handle customer.subscription.created
 * Subscription has been created (may fire after checkout.session.completed)
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id);

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.error('No customer ID for subscription:', subscription.id);
    return;
  }

  const userId = subscription.metadata?.supabase_user_id || 
                 await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error('Could not find user for subscription:', subscription.id);
    return;
  }

  await updateUserSubscription(userId, {
    tier: 1,
    subscription_status: subscription.status,
    subscription_id: subscription.id,
    subscription_ends_at: unixToIso(subscription.cancel_at),
  });
}

/**
 * Handle customer.subscription.updated
 * Subscription status changed (renewal, payment update, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id, 'Status:', subscription.status);

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.error('No customer ID for subscription:', subscription.id);
    return;
  }

  const userId = subscription.metadata?.supabase_user_id || 
                 await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error('Could not find user for subscription:', subscription.id);
    return;
  }

  // Determine tier based on status
  // Active, trialing = tier 1
  // Past due = tier 1 (grace period)
  // Canceled, unpaid = tier 0
  const activeTier = ['active', 'trialing', 'past_due'].includes(subscription.status) ? 1 : 0;

  await updateUserSubscription(userId, {
    tier: activeTier,
    subscription_status: subscription.status,
    subscription_ends_at: unixToIso(subscription.cancel_at),
  });
}

/**
 * Handle customer.subscription.deleted
 * Subscription has been canceled/ended
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.error('No customer ID for subscription:', subscription.id);
    return;
  }

  const userId = subscription.metadata?.supabase_user_id || 
                 await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error('Could not find user for subscription:', subscription.id);
    return;
  }

  await updateUserSubscription(userId, {
    tier: 0,
    subscription_status: 'canceled',
    subscription_id: null,
    subscription_ends_at: null,
  });
}

/**
 * Handle invoice.payment_failed
 * Payment attempt failed
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id);

  const customerId = getCustomerId(invoice.customer);
  if (!customerId) {
    console.error('No customer ID for invoice:', invoice.id);
    return;
  }

  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error('Could not find user for invoice:', invoice.id);
    return;
  }

  // Update status to past_due - user keeps access but needs to fix payment
  await updateUserSubscription(userId, {
    subscription_status: 'past_due',
  });
}

/**
 * Handle invoice.payment_succeeded
 * Payment succeeded (could be recovery from failed payment)
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Skip non-subscription invoices (one-time payments, etc.)
  // Check if this is a subscription-related invoice by looking at billing_reason
  const billingReason = invoice.billing_reason;
  if (!billingReason || !['subscription_create', 'subscription_cycle', 'subscription_update'].includes(billingReason)) {
    console.log('Skipping non-subscription invoice:', invoice.id, 'reason:', billingReason);
    return;
  }

  console.log('Payment succeeded for invoice:', invoice.id);

  const customerId = getCustomerId(invoice.customer);
  if (!customerId) {
    console.error('No customer ID for invoice:', invoice.id);
    return;
  }

  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error('Could not find user for invoice:', invoice.id);
    return;
  }

  // Payment succeeded = subscription is active
  await updateUserSubscription(userId, {
    tier: 1,
    subscription_status: 'active',
  });
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('No stripe-signature header');
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Invalid signature', { status: 400 });
    }

    console.log('Received webhook event:', event.type);

    // Route to appropriate handler
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook handler failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});