-- Drop airtable_id column from appointments table (redundant)
ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS airtable_id;

-- Add service_id to waitlist table (replacing treatment_id)
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- Drop treatment_id from waitlist table
ALTER TABLE public.waitlist
  DROP COLUMN IF EXISTS treatment_id;

-- Drop reschedule_treatment_id from proposed_meetings table
ALTER TABLE public.proposed_meetings
  DROP COLUMN IF EXISTS reschedule_treatment_id;

-- Drop the treatments table entirely (redundant with services)
DROP TABLE IF EXISTS public.treatments CASCADE;

