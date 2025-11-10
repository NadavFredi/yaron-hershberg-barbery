-- Migration to remove is_active and remote_booking_allowed from breeds table
-- These fields are now calculated dynamically from station_breed_rules
-- The actual values are stored at the station-breed level in station_breed_rules table

BEGIN;

-- Drop indexes if they exist
DROP INDEX IF EXISTS public.idx_breeds_is_active;
DROP INDEX IF EXISTS public.idx_breeds_remote_booking;

-- Remove columns from breeds table
ALTER TABLE public.breeds
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE public.breeds
  DROP COLUMN IF EXISTS remote_booking_allowed;

COMMIT;

