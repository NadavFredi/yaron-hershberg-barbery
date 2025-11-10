-- Migration to add settings-related fields to breeds table
-- This migration adds hourly_price, notes, and remote_booking_allowed fields

BEGIN;

-- Add hourly_price to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS hourly_price numeric(10,2);

-- Add notes to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS notes text;

-- Add remote_booking_allowed to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS remote_booking_allowed boolean NOT NULL DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_breeds_remote_booking ON public.breeds(remote_booking_allowed);

COMMENT ON COLUMN public.breeds.hourly_price IS 'מחיר שעתי לגזע זה';
COMMENT ON COLUMN public.breeds.notes IS 'הערות נוספות על הגזע';
COMMENT ON COLUMN public.breeds.remote_booking_allowed IS 'האם לקוחות יכולים לקבוע תור מרחוק עבור גזע זה';

COMMIT;

