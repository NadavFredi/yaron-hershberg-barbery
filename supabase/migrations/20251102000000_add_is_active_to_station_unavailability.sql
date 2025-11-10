-- Add is_active column to station_unavailability table
-- If is_active is true, the constraint means the station is AVAILABLE during that time
-- If is_active is false, the constraint means the station is UNAVAILABLE during that time
-- Default to false (unavailable) to maintain backward compatibility

BEGIN;

ALTER TABLE public.station_unavailability
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.station_unavailability.is_active IS 
  'If true, constraint makes station available during this time. If false, constraint makes station unavailable.';

COMMIT;

