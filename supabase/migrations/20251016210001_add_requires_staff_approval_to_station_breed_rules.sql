-- Migration to add requires_staff_approval to station_breed_rules table
-- This allows managing breed-station specific staff approval requirements

BEGIN;

-- Add requires_staff_approval to station_breed_rules table
ALTER TABLE public.station_breed_rules
  ADD COLUMN IF NOT EXISTS requires_staff_approval boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_station_breed_rules_requires_staff_approval ON public.station_breed_rules(requires_staff_approval);

COMMENT ON COLUMN public.station_breed_rules.requires_staff_approval IS 'האם גזע זה דורש אישור צוות בעמדה זו';

COMMIT;

