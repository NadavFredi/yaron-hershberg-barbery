-- Drop views that depend on treatment_id first
DROP VIEW IF EXISTS public.daycare_appointments CASCADE;
DROP VIEW IF EXISTS public.grooming_appointments CASCADE;

-- Drop treatment_id column from appointments table
-- Treatments are redundant with services, so we don't need treatment_id
ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS treatment_id;

-- Drop the index on treatment_id
DROP INDEX IF EXISTS public.idx_appointments_treatment;

