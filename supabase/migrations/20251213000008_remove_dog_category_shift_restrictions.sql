-- Remove dog category shift restriction tables and references
-- This migration removes shift_allowed_dog_categories and shift_blocked_dog_categories tables

-- Drop foreign key constraints first
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop foreign keys on shift_allowed_dog_categories
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'shift_allowed_dog_categories'
  ) THEN
    FOR r IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'shift_allowed_dog_categories'
    ) LOOP
      EXECUTE format('ALTER TABLE public.shift_allowed_dog_categories DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END IF;

  -- Drop foreign keys on shift_blocked_dog_categories
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'shift_blocked_dog_categories'
  ) THEN
    FOR r IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'shift_blocked_dog_categories'
    ) LOOP
      EXECUTE format('ALTER TABLE public.shift_blocked_dog_categories DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END IF;
END;
$$;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_shift_allowed_dog_categories_shift;
DROP INDEX IF EXISTS public.idx_shift_allowed_dog_categories_category;
DROP INDEX IF EXISTS public.idx_shift_blocked_dog_categories_shift;
DROP INDEX IF EXISTS public.idx_shift_blocked_dog_categories_category;

-- Drop the tables
DROP TABLE IF EXISTS public.shift_allowed_dog_categories CASCADE;
DROP TABLE IF EXISTS public.shift_blocked_dog_categories CASCADE;

