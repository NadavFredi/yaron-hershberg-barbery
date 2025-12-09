-- Fix pinned_appointments table to match backup schema
-- Add missing appointment_type column and related enums

BEGIN;

-- Create pin_reason enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pin_reason') THEN
    CREATE TYPE public.pin_reason AS ENUM (
      'reschedule',
      'attention',
      'special',
      'date_change',
      'quick_access'
    );
  END IF;
END $$;

-- Create service_category enum if it doesn't exist (only grooming, no daycare)
-- Note: backup schema has 'grooming', 'daycare', 'retail', but we only use 'grooming'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_category') THEN
    CREATE TYPE public.service_category AS ENUM (
      'grooming'
      -- Removed 'daycare' and 'retail' - barbery system only has grooming appointments
    );
  ELSE
    -- If enum exists but has other values, we can't easily remove them in PostgreSQL
    -- The check constraint will enforce only grooming
    NULL;
  END IF;
END $$;

-- Drop the old unique constraint if it exists
ALTER TABLE public.pinned_appointments 
  DROP CONSTRAINT IF EXISTS pinned_appointments_unique;

-- Drop the foreign key constraint to appointments table (which doesn't exist)
ALTER TABLE public.pinned_appointments 
  DROP CONSTRAINT IF EXISTS pinned_appointments_appointment_id_fkey;

-- Add appointment_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pinned_appointments' 
    AND column_name = 'appointment_type'
  ) THEN
    ALTER TABLE public.pinned_appointments 
      ADD COLUMN appointment_type public.service_category NOT NULL DEFAULT 'grooming';
  END IF;
END $$;

-- Update reason column to use enum type if it's currently TEXT
DO $$
BEGIN
  -- Check if reason column exists and is TEXT type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pinned_appointments' 
    AND column_name = 'reason'
    AND data_type = 'text'
  ) THEN
    -- Convert existing TEXT values to enum
    -- Set default for any NULL values or invalid values
    UPDATE public.pinned_appointments 
    SET reason = 'quick_access' 
    WHERE reason IS NULL 
       OR reason NOT IN ('reschedule', 'attention', 'special', 'date_change', 'quick_access');
    
    -- Change column type to enum
    ALTER TABLE public.pinned_appointments 
      ALTER COLUMN reason TYPE public.pin_reason USING reason::public.pin_reason,
      ALTER COLUMN reason SET DEFAULT 'quick_access'::public.pin_reason,
      ALTER COLUMN reason SET NOT NULL;
  END IF;
END $$;

-- Add foreign key to grooming_appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'pinned_appointments' 
    AND constraint_name = 'pinned_appointments_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.pinned_appointments 
      ADD CONSTRAINT pinned_appointments_appointment_id_fkey 
      FOREIGN KEY (appointment_id) 
      REFERENCES public.grooming_appointments(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint with appointment_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'pinned_appointments' 
    AND constraint_name = 'pinned_appointments_user_id_appointment_id_appointment_type_key'
  ) THEN
    ALTER TABLE public.pinned_appointments 
      ADD CONSTRAINT pinned_appointments_user_id_appointment_id_appointment_type_key 
      UNIQUE (user_id, appointment_id, appointment_type);
  END IF;
END $$;

-- Add check constraint to ensure only grooming appointments (if enum only has grooming, this is redundant but safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'pinned_appointments' 
    AND constraint_name = 'pinned_appointments_appointment_type_check'
  ) THEN
    ALTER TABLE public.pinned_appointments 
      ADD CONSTRAINT pinned_appointments_appointment_type_check 
      CHECK (appointment_type = 'grooming'::public.service_category);
  END IF;
END $$;

-- Update indexes to include appointment_type
DROP INDEX IF EXISTS public.idx_pinned_appointments_appt;
CREATE INDEX IF NOT EXISTS idx_pinned_appointments_appointment 
  ON public.pinned_appointments (appointment_id, appointment_type);

CREATE INDEX IF NOT EXISTS idx_pinned_appointments_auto_remove 
  ON public.pinned_appointments (auto_remove_after) 
  WHERE auto_remove_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pinned_appointments_reason 
  ON public.pinned_appointments (user_id, reason);

COMMENT ON COLUMN public.pinned_appointments.appointment_type IS 'Type of appointment being pinned. Currently only grooming is supported.';

COMMIT;

