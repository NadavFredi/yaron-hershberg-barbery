-- Remove all dogs and breeds tables and references
-- This migration removes all dog/breed related tables, columns, constraints, and indexes

-- Step 1: Drop foreign key constraints that reference dogs or breeds
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop foreign key constraints on columns referencing dogs/breeds
  
  -- grooming_appointments.dog_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'grooming_appointments' 
    AND constraint_name = 'grooming_appointments_dog_id_fkey'
  ) THEN
    ALTER TABLE public.grooming_appointments DROP CONSTRAINT IF EXISTS grooming_appointments_dog_id_fkey;
  END IF;

  -- daycare_appointments.dog_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'daycare_appointments' 
    AND constraint_name = 'daycare_appointments_dog_id_fkey'
  ) THEN
    ALTER TABLE public.daycare_appointments DROP CONSTRAINT IF EXISTS daycare_appointments_dog_id_fkey;
  END IF;

  -- daycare_waitlist.dog_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'daycare_waitlist' 
    AND constraint_name = 'daycare_waitlist_dog_id_fkey'
  ) THEN
    ALTER TABLE public.daycare_waitlist DROP CONSTRAINT IF EXISTS daycare_waitlist_dog_id_fkey;
  END IF;

  -- garden_questionnaires.dog_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'garden_questionnaires' 
    AND constraint_name = 'garden_questionnaires_dog_id_fkey'
  ) THEN
    ALTER TABLE public.garden_questionnaires DROP CONSTRAINT IF EXISTS garden_questionnaires_dog_id_fkey;
  END IF;

  -- ticket_usages.dog_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'ticket_usages' 
    AND constraint_name = 'ticket_usages_dog_id_fkey'
  ) THEN
    ALTER TABLE public.ticket_usages DROP CONSTRAINT IF EXISTS ticket_usages_dog_id_fkey;
  END IF;

  -- proposed_meetings.reschedule_dog_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'proposed_meetings' 
    AND constraint_name = 'proposed_meetings_reschedule_dog_id_fkey'
  ) THEN
    ALTER TABLE public.proposed_meetings DROP CONSTRAINT IF EXISTS proposed_meetings_reschedule_dog_id_fkey;
  END IF;

  -- dogs.breed_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'dogs' 
    AND constraint_name = 'dogs_breed_id_fkey'
  ) THEN
    ALTER TABLE public.dogs DROP CONSTRAINT IF EXISTS dogs_breed_id_fkey;
  END IF;

  -- breed_modifiers.breed_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'breed_modifiers' 
    AND constraint_name = 'breed_modifiers_breed_id_fkey'
  ) THEN
    ALTER TABLE public.breed_modifiers DROP CONSTRAINT IF EXISTS breed_modifiers_breed_id_fkey;
  END IF;

  -- station_breed_rules.breed_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'station_breed_rules' 
    AND constraint_name = 'station_breed_rules_breed_id_fkey'
  ) THEN
    ALTER TABLE public.station_breed_rules DROP CONSTRAINT IF EXISTS station_breed_rules_breed_id_fkey;
  END IF;

  -- Any other breed-related foreign keys
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND constraint_name LIKE '%breed%fkey'
  ) THEN
    -- Drop any remaining breed foreign keys
    FOR r IN (
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_name LIKE '%breed%fkey'
    ) LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
  END IF;

  -- Any other dog-related foreign keys
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND constraint_name LIKE '%dog%fkey'
  ) THEN
    -- Drop any remaining dog foreign keys
    FOR r IN (
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_name LIKE '%dog%fkey'
    ) LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
  END IF;
END;
$$;

-- Step 2: Drop indexes on dog_id and breed_id columns
DROP INDEX IF EXISTS public.idx_grooming_appointments_dog;
DROP INDEX IF EXISTS public.idx_daycare_appointments_dog;
DROP INDEX IF EXISTS public.idx_daycare_waitlist_dog;
DROP INDEX IF EXISTS public.idx_garden_questionnaires_dog;
DROP INDEX IF EXISTS public.idx_ticket_usages_dog;
DROP INDEX IF EXISTS public.idx_dogs_breed;
DROP INDEX IF EXISTS public.idx_breed_modifiers_breed;
DROP INDEX IF EXISTS public.idx_station_breed_rules_breed;

-- Step 3: Drop columns that reference dogs/breeds
DO $$
BEGIN
  -- Drop columns only if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grooming_appointments') THEN
    ALTER TABLE public.grooming_appointments DROP COLUMN IF EXISTS dog_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daycare_appointments') THEN
    ALTER TABLE public.daycare_appointments DROP COLUMN IF EXISTS dog_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daycare_waitlist') THEN
    ALTER TABLE public.daycare_waitlist DROP COLUMN IF EXISTS dog_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'garden_questionnaires') THEN
    ALTER TABLE public.garden_questionnaires DROP COLUMN IF EXISTS dog_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_usages') THEN
    ALTER TABLE public.ticket_usages DROP COLUMN IF EXISTS dog_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proposed_meetings') THEN
    ALTER TABLE public.proposed_meetings DROP COLUMN IF EXISTS reschedule_dog_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proposed_meeting_invites') THEN
    ALTER TABLE public.proposed_meeting_invites DROP COLUMN IF EXISTS dog_id;
  END IF;
END;
$$;

-- Step 4: Drop junction/bridge tables related to breeds/dogs
DROP TABLE IF EXISTS public.breed_dog_categories CASCADE;
DROP TABLE IF EXISTS public.breed_modifiers CASCADE;
DROP TABLE IF EXISTS public.station_breed_rules CASCADE;
DROP TABLE IF EXISTS public.dog_categories CASCADE;
DROP TABLE IF EXISTS public.breed_service_rules CASCADE;
DROP TABLE IF EXISTS public.breed_treatment_types CASCADE;

-- Also drop shift dog category restriction tables (handled in separate migration but ensuring here too)
DROP TABLE IF EXISTS public.shift_allowed_dog_categories CASCADE;
DROP TABLE IF EXISTS public.shift_blocked_dog_categories CASCADE;

-- Step 5: Drop main dogs and breeds tables
DROP TABLE IF EXISTS public.dogs CASCADE;
DROP TABLE IF EXISTS public.breeds CASCADE;

-- Step 6: Drop related enums if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dog_gender') THEN
    DROP TYPE public.dog_gender CASCADE;
  END IF;
END;
$$;

-- Step 7: Drop any remaining indexes that might reference dogs/breeds
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND (indexname LIKE '%dog%' OR indexname LIKE '%breed%')
  ) LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I CASCADE', r.indexname);
  END LOOP;
END;
$$;

