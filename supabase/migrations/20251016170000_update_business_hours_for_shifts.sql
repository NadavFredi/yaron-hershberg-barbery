-- Migration to support multiple shifts per day in business_hours table
-- Remove unique constraint on weekday and add shift_order field

BEGIN;

-- Drop the unique constraint on weekday
ALTER TABLE public.business_hours DROP CONSTRAINT IF EXISTS business_hours_weekday_key;

-- Add shift_order column to support multiple shifts per day
ALTER TABLE public.business_hours
  ADD COLUMN IF NOT EXISTS shift_order integer NOT NULL DEFAULT 0;

-- Create a composite unique constraint on (weekday, shift_order)
ALTER TABLE public.business_hours
  ADD CONSTRAINT business_hours_weekday_shift_order_unique UNIQUE (weekday, shift_order);

-- Create index for faster lookups by weekday
CREATE INDEX IF NOT EXISTS idx_business_hours_weekday_shift ON public.business_hours(weekday, shift_order);

COMMENT ON COLUMN public.business_hours.shift_order IS 'סדר המשמרות באותו יום (0 = משמרת ראשונה, 1 = משמרת שנייה וכו)';

COMMIT;

