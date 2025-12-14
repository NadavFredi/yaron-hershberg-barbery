-- Change treatment_id to text to store external IDs from old system
-- This allows us to store composite identifiers (CustomerID-date-treatment) from the migration

-- Drop the foreign key constraint if it exists (it should already be nullable with no FK per previous migration)
DO $$
BEGIN
  -- Drop foreign key constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'grooming_appointments_treatment_id_fkey'
    AND table_name = 'grooming_appointments'
  ) THEN
    ALTER TABLE public.grooming_appointments
      DROP CONSTRAINT grooming_appointments_treatment_id_fkey;
  END IF;
END $$;

-- Change column type from uuid to text
-- Using USING clause to convert existing values
ALTER TABLE public.grooming_appointments
  ALTER COLUMN treatment_id TYPE text USING treatment_id::text;

-- Drop old index if it exists (based on uuid type)
DROP INDEX IF EXISTS idx_grooming_appointments_treatment;

-- Add new index for faster lookups by treatment_id (now text)
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_treatment_text 
  ON public.grooming_appointments(treatment_id) 
  WHERE treatment_id IS NOT NULL;
