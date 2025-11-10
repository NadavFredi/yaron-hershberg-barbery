-- Migration to assign the first breed to dogs without a breed
-- This migration ensures all dogs have a breed assigned

BEGIN;

-- Update dogs that don't have a breed_id
-- Assign them the first breed (by ID order)
UPDATE public.dogs d
SET breed_id = (
    SELECT id 
    FROM public.breeds 
    ORDER BY id 
    LIMIT 1
)
WHERE d.breed_id IS NULL;

-- If there are no breeds in the database, this will leave breed_id as NULL
-- which is acceptable as the application will handle this case

COMMENT ON COLUMN public.dogs.breed_id IS 'Required: Every dog must have a breed assigned.';

COMMIT;
