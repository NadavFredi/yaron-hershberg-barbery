-- Migration to backfill breeds.size_class from dogs.is_small
-- This migration populates breed size_class from existing dog data
-- for breeds that don't have size_class set yet

BEGIN;

-- Update breeds that don't have size_class set
-- Use the most common is_small value for dogs of that breed
UPDATE public.breeds b
SET size_class = CASE
    WHEN most_common_size.avg_is_small >= 0.5 THEN 'small'
    WHEN most_common_size.avg_is_small < 0.5 AND most_common_size.avg_is_small IS NOT NULL THEN 'large'
    ELSE NULL
END
FROM (
    SELECT 
        d.breed_id,
        AVG(CASE 
            WHEN d.is_small = true THEN 1.0 
            WHEN d.is_small = false THEN 0.0 
            ELSE NULL 
        END) as avg_is_small
    FROM public.dogs d
    WHERE d.breed_id IS NOT NULL
      AND d.is_small IS NOT NULL
    GROUP BY d.breed_id
) most_common_size
WHERE b.id = most_common_size.breed_id
  AND (b.size_class IS NULL OR b.size_class = '');

-- For breeds with mixed sizes or where we can't determine, leave as NULL
-- This is safe as the code already handles NULL size_class

COMMENT ON COLUMN public.dogs.is_small IS 'DEPRECATED: Use breeds.size_class instead. Kept for backwards compatibility.';

COMMIT;
