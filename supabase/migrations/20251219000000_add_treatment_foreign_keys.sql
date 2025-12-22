-- Add foreign key constraints for treatment_id columns
-- This migration adds FK constraints so PostgREST can recognize relationships

-- Ensure pg_trgm extension is enabled for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ensure treatment_gender enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatment_gender') THEN
    CREATE TYPE public.treatment_gender AS ENUM ('male', 'female', 'unknown');
  END IF;
END $$;

-- First, ensure the treatments table exists (it was dropped in an earlier migration)
CREATE TABLE IF NOT EXISTS public.treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender public.treatment_gender NOT NULL DEFAULT 'male',
  treatment_type_id uuid REFERENCES public.treatment_types(id),
  birth_date date,
  health_notes text,
  vet_name text,
  vet_phone text,
  staff_notes text,
  is_small boolean,
  aggression_risk boolean,
  people_anxious boolean,
  questionnaire_result public.questionnaire_result NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for treatments table
CREATE INDEX IF NOT EXISTS idx_treatments_customer ON public.treatments(customer_id);
CREATE INDEX IF NOT EXISTS idx_treatments_name_trgm ON public.treatments USING gin (name gin_trgm_ops);

-- Ensure treatment_id columns are UUID type (convert from TEXT if needed)
DO $$
BEGIN
  -- Check if grooming_appointments.treatment_id is TEXT and convert to UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'grooming_appointments' 
    AND column_name = 'treatment_id'
    AND data_type = 'text'
  ) THEN
    -- Convert TEXT to UUID, only keeping valid UUID strings
    -- This will set NULL for invalid UUIDs
    ALTER TABLE public.grooming_appointments
      ALTER COLUMN treatment_id TYPE uuid USING 
        CASE 
          WHEN treatment_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          THEN treatment_id::uuid
          ELSE NULL
        END;
  END IF;

  -- Check if daycare_appointments.treatment_id is TEXT and convert to UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daycare_appointments' 
    AND column_name = 'treatment_id'
    AND data_type = 'text'
  ) THEN
    -- Convert TEXT to UUID, only keeping valid UUID strings
    ALTER TABLE public.daycare_appointments
      ALTER COLUMN treatment_id TYPE uuid USING 
        CASE 
          WHEN treatment_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          THEN treatment_id::uuid
          ELSE NULL
        END;
  END IF;
END $$;

-- Add foreign key constraint for grooming_appointments.treatment_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'grooming_appointments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'grooming_appointments' 
    AND constraint_name = 'grooming_appointments_treatment_id_fkey'
  ) THEN
    ALTER TABLE public.grooming_appointments
      ADD CONSTRAINT grooming_appointments_treatment_id_fkey
      FOREIGN KEY (treatment_id) 
      REFERENCES public.treatments(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key constraint for daycare_appointments.treatment_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'daycare_appointments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'daycare_appointments' 
    AND constraint_name = 'daycare_appointments_treatment_id_fkey'
  ) THEN
    ALTER TABLE public.daycare_appointments
      ADD CONSTRAINT daycare_appointments_treatment_id_fkey
      FOREIGN KEY (treatment_id) 
      REFERENCES public.treatments(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Recreate indexes if they were dropped (only if tables exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'grooming_appointments'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_grooming_appointments_treatment 
      ON public.grooming_appointments(treatment_id, start_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'daycare_appointments'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_daycare_appointments_treatment 
      ON public.daycare_appointments(treatment_id, start_at);
  END IF;
END $$;

