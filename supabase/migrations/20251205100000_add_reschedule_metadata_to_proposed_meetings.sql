-- Add reschedule metadata fields to proposed meetings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meetings'
      AND column_name = 'reschedule_appointment_id'
  ) THEN
    ALTER TABLE public.proposed_meetings
      ADD COLUMN reschedule_appointment_id uuid REFERENCES public.grooming_appointments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meetings'
      AND column_name = 'reschedule_customer_id'
  ) THEN
    ALTER TABLE public.proposed_meetings
      ADD COLUMN reschedule_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meetings'
      AND column_name = 'reschedule_dog_id'
  ) THEN
    ALTER TABLE public.proposed_meetings
      ADD COLUMN reschedule_dog_id uuid REFERENCES public.dogs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meetings'
      AND column_name = 'reschedule_original_start_at'
  ) THEN
    ALTER TABLE public.proposed_meetings
      ADD COLUMN reschedule_original_start_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meetings'
      AND column_name = 'reschedule_original_end_at'
  ) THEN
    ALTER TABLE public.proposed_meetings
      ADD COLUMN reschedule_original_end_at timestamptz;
  END IF;
END;
$$;

-- Ensure helpful indexes for reschedule lookups
CREATE INDEX IF NOT EXISTS idx_proposed_meetings_reschedule_appointment
  ON public.proposed_meetings (reschedule_appointment_id);

CREATE INDEX IF NOT EXISTS idx_proposed_meetings_reschedule_customer
  ON public.proposed_meetings (reschedule_customer_id);

CREATE INDEX IF NOT EXISTS idx_proposed_meetings_reschedule_dog
  ON public.proposed_meetings (reschedule_dog_id);
