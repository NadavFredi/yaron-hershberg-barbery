-- Add client_confirmed_arrival column to grooming_appointments if it doesn't exist
-- This column was missing from the initial table creation

BEGIN;

-- Add client_confirmed_arrival to grooming_appointments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'grooming_appointments' 
    AND column_name = 'client_confirmed_arrival'
  ) THEN
    ALTER TABLE public.grooming_appointments 
      ADD COLUMN client_confirmed_arrival BOOLEAN NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN public.grooming_appointments.client_confirmed_arrival IS 'Client confirmation that they will arrive for the appointment. Separate from manager approval (status field). Only clients can update this field.';
  END IF;
END $$;

COMMIT;

