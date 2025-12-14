-- Add default minutes field for "dog is ready" notification
-- This allows managers to set a default value for the "your dog will be ready in X minutes" modal

BEGIN;

-- Add column to appointment_reminder_settings table
ALTER TABLE public.appointment_reminder_settings
  ADD COLUMN IF NOT EXISTS dog_ready_default_minutes integer DEFAULT 30;

-- Add check constraint to ensure minutes is positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dog_ready_default_minutes_positive'
  ) THEN
    ALTER TABLE public.appointment_reminder_settings
      ADD CONSTRAINT dog_ready_default_minutes_positive
      CHECK (dog_ready_default_minutes IS NULL OR dog_ready_default_minutes > 0);
  END IF;
END;
$$;

-- Update existing rows to have default value of 30 if null
UPDATE public.appointment_reminder_settings
SET dog_ready_default_minutes = 30
WHERE dog_ready_default_minutes IS NULL;

COMMIT;

