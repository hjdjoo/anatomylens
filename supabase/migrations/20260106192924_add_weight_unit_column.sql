-- Migration: Add weight_unit preference to user_profiles
-- This allows users to set their preferred unit for exercise weights

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg'));

COMMENT ON COLUMN public.user_profiles.weight_unit IS 'User preferred weight unit: lbs or kg';
