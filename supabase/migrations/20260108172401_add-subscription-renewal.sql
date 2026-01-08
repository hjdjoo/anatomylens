-- Migration: Add subscription_renews_at to user_profiles
-- This column tracks when the subscription will next renew (null if canceled)

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS subscription_renews_at timestamptz DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.subscription_renews_at IS 
  'Next renewal date for active subscriptions. NULL if subscription is canceled or user is on free tier.';

-- Update subscription_ends_at comment for clarity
COMMENT ON COLUMN public.user_profiles.subscription_ends_at IS 
  'When premium access ends. Set when user cancels (access continues until this date). NULL for active/renewing subscriptions.';