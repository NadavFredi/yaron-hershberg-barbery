-- Remove all garden (daycare) and breed-related database structures
-- This migration removes all garden/daycare functionality and breed logic from the database

BEGIN;

-- Step 1: Drop foreign key constraints that reference daycare_appointments
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop foreign keys from orders table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'orders' 
    AND constraint_name LIKE '%daycare_appointment%'
  ) THEN
    FOR r IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'orders' 
      AND constraint_name LIKE '%daycare_appointment%'
    ) LOOP
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END IF;

  -- Drop foreign keys from carts table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'carts' 
    AND constraint_name LIKE '%daycare_appointment%'
  ) THEN
    FOR r IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'carts' 
      AND constraint_name LIKE '%daycare_appointment%'
    ) LOOP
      EXECUTE format('ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END IF;

  -- Drop foreign keys from appointment_reminder_sent table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'appointment_reminder_sent' 
    AND constraint_name LIKE '%daycare%'
  ) THEN
    FOR r IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'appointment_reminder_sent' 
      AND constraint_name LIKE '%daycare%'
    ) LOOP
      EXECUTE format('ALTER TABLE public.appointment_reminder_sent DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END IF;
END;
$$;

-- Step 2: Drop columns that reference daycare_appointments
DO $$
BEGIN
  -- Drop daycare_appointment_id from orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders DROP COLUMN IF EXISTS daycare_appointment_id;
  END IF;

  -- Drop daycare_appointment_id from carts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'carts') THEN
    ALTER TABLE public.carts DROP COLUMN IF EXISTS daycare_appointment_id;
  END IF;
END;
$$;

-- Step 3: Drop indexes related to daycare_appointments
DROP INDEX IF EXISTS public.idx_daycare_appointments_customer;
DROP INDEX IF EXISTS public.idx_daycare_appointments_treatment;
DROP INDEX IF EXISTS public.idx_daycare_appointments_station;
DROP INDEX IF EXISTS public.idx_daycare_appointments_dog;

-- Step 4: Drop the daycare_appointments table
DROP TABLE IF EXISTS public.daycare_appointments CASCADE;

-- Step 5: Drop garden-related tables
DROP TABLE IF EXISTS public.garden_questionnaires CASCADE;
DROP TABLE IF EXISTS public.daycare_waitlist CASCADE;
DROP TABLE IF EXISTS public.waitlist CASCADE;

-- Step 6: Drop garden-related enums if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daycare_service_type') THEN
    DROP TYPE public.daycare_service_type CASCADE;
  END IF;
END;
$$;

-- Step 7: Remove garden-related columns from stations table (if service_type column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stations') THEN
    -- Check if service_type column exists and remove 'garden' from enum if it's an enum
    -- Note: We're not dropping the column, just ensuring no garden values
    ALTER TABLE public.stations DROP CONSTRAINT IF EXISTS stations_service_type_check;
  END IF;
END;
$$;

-- Step 8: Drop breed-related tables (if they still exist after previous migration)
DROP TABLE IF EXISTS public.station_breed_rules CASCADE;
DROP TABLE IF EXISTS public.breed_modifiers CASCADE;
DROP TABLE IF EXISTS public.breed_dog_categories CASCADE;
DROP TABLE IF EXISTS public.breed_service_rules CASCADE;
DROP TABLE IF EXISTS public.breed_treatment_types CASCADE;

-- Step 9: Drop any remaining indexes with garden or breed in the name (excluding constraints)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT i.indexname 
    FROM pg_indexes i
    LEFT JOIN pg_constraint c ON c.conname = i.indexname AND c.contype IN ('p', 'u')
    WHERE i.schemaname = 'public' 
    AND (i.indexname LIKE '%garden%' OR i.indexname LIKE '%daycare%' OR i.indexname LIKE '%breed%')
    AND c.conname IS NULL  -- Exclude primary key and unique constraints
  ) LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I CASCADE', r.indexname);
  END LOOP;
END;
$$;

-- Step 10: Remove garden/daycare from service_scope enum if it exists
-- Note: waitlist table is dropped in Step 5, so we only need to update the enum if other tables use it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_scope') THEN
    IF EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'daycare' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'service_scope')
    ) THEN
      CREATE TYPE public.service_scope_new AS ENUM ('grooming', 'both');
      
      -- Update any remaining tables that use service_scope (waitlist is already dropped in Step 5)
      -- If there are other tables using this enum, update them here
      
      DROP TYPE public.service_scope CASCADE;
      ALTER TYPE public.service_scope_new RENAME TO service_scope;
    END IF;
  END IF;
END;
$$;

COMMIT;
