-- Migration to add is_active and remote_booking_allowed fields to station_breed_rules table
-- This allows managing breed-station specific active status and remote booking availability

BEGIN;

-- Add is_active to station_breed_rules table
ALTER TABLE public.station_breed_rules
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add remote_booking_allowed to station_breed_rules table
ALTER TABLE public.station_breed_rules
  ADD COLUMN IF NOT EXISTS remote_booking_allowed boolean NOT NULL DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_station_breed_rules_is_active ON public.station_breed_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_station_breed_rules_remote_booking ON public.station_breed_rules(remote_booking_allowed);

COMMENT ON COLUMN public.station_breed_rules.is_active IS 'האם הגזע פעיל עבור עמדה זו';
COMMENT ON COLUMN public.station_breed_rules.remote_booking_allowed IS 'האם ניתן לקבוע תור מרחוק עבור גזע זה בעמדה זו';

COMMIT;

