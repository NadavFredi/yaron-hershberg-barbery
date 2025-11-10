-- Migration to remove requires_staff_approval from breeds table
-- This field is now calculated dynamically from station_breed_rules
-- The actual values are stored at the station-breed level in station_breed_rules table

BEGIN;

-- Drop index if it exists
DROP INDEX IF EXISTS public.idx_breeds_requires_staff_approval;

-- Remove column from breeds table
ALTER TABLE public.breeds
  DROP COLUMN IF EXISTS requires_staff_approval;

COMMIT;

