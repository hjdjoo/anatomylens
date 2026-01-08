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
 * - customer.subscription.updated: Status/period changes, cancellation scheduled
 * - customer.subscription.deleted: Subscription ended (after period)
 * - invoice.payment_failed: Payment issue
 * - invoice.payment_succeeded: Payment recovered
 */

import Stripe from 'npm:stripe';
import { createSupabaseAdmin } from '../_shared/supabase.ts';

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
 * Subscription update payload for user_profiles
 */
interface SubscriptionUpdate {
  tier?: number;
  subscription_status?: string;
  subscription_id?: string | null;
  subscription_ends_at?: string | null;      // When access ends (cancel_at or current_period_end if canceled)
  subscription_renews_at?: string | null;    // Next renewal date (null if canceled)
  stripe_customer_id?: string;
}

/**
 * Update user subscription status in database
 */
async function updateUserSubscription(
  userId: string,
  updates: SubscriptionUpdate,
  eventId?: string
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
    console.error(`[${eventId}] Error updating user ${userId}:`, error);
    throw error;
  }

  console.log(`[${eventId}] Updated user ${userId}:`, JSON.stringify(updates));
}

/**
 * Convert Unix timestamp to ISO string
 */
function unixToIso(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Get current_period_end from subscription items
 * This field lives on items.data[0], not on the subscription root
 */
function getCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  // Access from first subscription item
  const firstItem = subscription.items?.data?.[0];
  if (firstItem?.current_period_end) {
    return firstItem.current_period_end;
  }
  return null;
}

/**
 * Determine tier from subscription status
 * - Active statuses (active, trialing, past_due) = tier 1
 * - Inactive statuses (canceled, unpaid, incomplete_expired) = tier 0
 */
function getTierFromStatus(status: Stripe.Subscription.Status): number {
  const activeStatuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
  return activeStatuses.includes(status) ? 1 : 0;
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Handle checkout.session.completed
 * User just finished checkout - subscription is being created
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  console.log(`[${eventId}] Checkout completed: ${session.id}`);

  const customerId = getCustomerId(session.customer);
  const subscriptionId = getSubscriptionId(session.subscription);

  if (!customerId || !subscriptionId) {
    console.error(`[${eventId}] Missing customer or subscription ID in checkout session`);
    return;
  }

  // Get user ID from metadata or customer lookup
  let userId = session.metadata?.supabase_user_id;
  
  if (!userId) {
    userId = await getUserIdFromCustomer(customerId) ?? undefined;
  }

  if (!userId) {
    console.error(`[${eventId}] Could not find user for checkout session: ${session.id}`);
    return;
  }

  // Fetch the subscription to get full details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await updateUserSubscription(userId, {
    tier: 1,
    subscription_status: subscription.status,
    subscription_id: subscriptionId,
    subscription_ends_at: null, // Not canceled yet
    subscription_renews_at: unixToIso(getCurrentPeriodEnd(subscription)),
    stripe_customer_id: customerId,
  }, eventId);
}

/**
 * Handle customer.subscription.created
 * Subscription has been created (may fire after checkout.session.completed)
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription, eventId: string) {
  console.log(`[${eventId}] Subscription created: ${subscription.id}`);

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.error(`[${eventId}] No customer ID for subscription: ${subscription.id}`);
    return;
  }

  const userId = subscription.metadata?.supabase_user_id || 
                 await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error(`[${eventId}] Could not find user for subscription: ${subscription.id}`);
    return;
  }

  await updateUserSubscription(userId, {
    tier: getTierFromStatus(subscription.status),
    subscription_status: subscription.status,
    subscription_id: subscription.id,
    subscription_ends_at: null,
    subscription_renews_at: unixToIso(getCurrentPeriodEnd(subscription)),
  }, eventId);
}

/**
 * Handle customer.subscription.updated
 * Subscription status changed (renewal, payment update, cancellation scheduled, etc.)
 * 
 * Key scenarios:
 * 1. Normal renewal: status=active, cancel_at_period_end=false
 * 2. User cancels: status=active, cancel_at_period_end=true (still has access!)
 * 3. Payment fails: status=past_due
 * 4. Payment recovered: status=active
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string) {
  console.log(`[${eventId}] Subscription updated: ${subscription.id}, status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}`);

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.error(`[${eventId}] No customer ID for subscription: ${subscription.id}`);
    return;
  }

  const userId = subscription.metadata?.supabase_user_id || 
                 await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error(`[${eventId}] Could not find user for subscription: ${subscription.id}`);
    return;
  }

  // Determine subscription state
  const isCanceled = subscription.cancel_at_period_end || subscription.status === 'canceled';
  const tier = getTierFromStatus(subscription.status);

  // Build update object
  const updates: SubscriptionUpdate = {
    tier,
    subscription_status: isCanceled && subscription.status === 'active' 
      ? 'canceling'  // Custom status: active but will cancel
      : subscription.status,
  };

  if (isCanceled) {
    // User has canceled - they keep access until period end
    // subscription_ends_at = when their access actually ends
    // subscription_renews_at = null (won't renew)
    updates.subscription_ends_at = unixToIso(getCurrentPeriodEnd(subscription));
    updates.subscription_renews_at = null;
  } else {
    // Active subscription - will renew
    updates.subscription_ends_at = null;
    updates.subscription_renews_at = unixToIso(getCurrentPeriodEnd(subscription));
  }

  await updateUserSubscription(userId, updates, eventId);
}

/**
 * Handle customer.subscription.deleted
 * Subscription has been canceled/ended - this fires AFTER the period ends
 * At this point, user should lose access
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string) {
  console.log(`[${eventId}] Subscription deleted: ${subscription.id}`);

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.error(`[${eventId}] No customer ID for subscription: ${subscription.id}`);
    return;
  }

  const userId = subscription.metadata?.supabase_user_id || 
                 await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error(`[${eventId}] Could not find user for subscription: ${subscription.id}`);
    return;
  }

  // Subscription is truly over - remove access
  await updateUserSubscription(userId, {
    tier: 0,
    subscription_status: 'canceled',
    subscription_id: null,
    subscription_ends_at: null,
    subscription_renews_at: null,
  }, eventId);
}

/**
 * Handle invoice.payment_failed
 * Payment attempt failed - user keeps access but needs to fix payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
  console.log(`[${eventId}] Payment failed for invoice: ${invoice.id}`);

  const customerId = getCustomerId(invoice.customer);
  if (!customerId) {
    console.error(`[${eventId}] No customer ID for invoice: ${invoice.id}`);
    return;
  }

  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error(`[${eventId}] Could not find user for invoice: ${invoice.id}`);
    return;
  }

  // Update status to past_due - user keeps tier 1 access but we track the issue
  await updateUserSubscription(userId, {
    subscription_status: 'past_due',
    // Keep tier: 1 - they still have access during grace period
  }, eventId);
}

/**
 * Handle invoice.payment_succeeded
 * Payment succeeded (could be recovery from failed payment)
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice, eventId: string) {
  // Only process subscription-related invoices
  const billingReason = invoice.billing_reason;
  if (!billingReason || !['subscription_create', 'subscription_cycle', 'subscription_update'].includes(billingReason)) {
    console.log(`[${eventId}] Skipping non-subscription invoice: ${invoice.id}, reason: ${billingReason}`);
    return;
  }

  console.log(`[${eventId}] Payment succeeded for invoice: ${invoice.id}`);

  const customerId = getCustomerId(invoice.customer);
  if (!customerId) {
    console.error(`[${eventId}] No customer ID for invoice: ${invoice.id}`);
    return;
  }

  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error(`[${eventId}] Could not find user for invoice: ${invoice.id}`);
    return;
  }

  // Get subscription to get current_period_end
  const subscriptionId = getSubscriptionId(invoice.parent?.subscription_details?.subscription || null);
  let renewsAt: string | null = null;
  
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      renewsAt = unixToIso(getCurrentPeriodEnd(subscription));
    } catch (err) {
      console.error(`[${eventId}] Error fetching subscription:`, err);
    }
  }

  // Payment succeeded = subscription is active
  await updateUserSubscription(userId, {
    tier: 1,
    subscription_status: 'active',
    subscription_renews_at: renewsAt,
  }, eventId);
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

    const eventId = event.id;
    console.log(`[${eventId}] Received: ${event.type}`);

    // Route to appropriate handler
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, eventId);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, eventId);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, eventId);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, eventId);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, eventId);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, eventId);
        break;

      default:
        console.log(`[${eventId}] Unhandled event type: ${event.type}`);
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