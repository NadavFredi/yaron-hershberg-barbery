-- Add arrival and treatment tracking columns to grooming_appointments
-- These columns track when clients/managers approve arrival and when treatment starts/ends

-- Add columns to grooming_appointments
ALTER TABLE public.grooming_appointments
  ADD COLUMN IF NOT EXISTS client_approved_arrival TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS manager_approved_arrival TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS treatment_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS treatment_ended_at TIMESTAMP WITH TIME ZONE;

-- Add comments to explain the columns
COMMENT ON COLUMN public.grooming_appointments.client_approved_arrival IS 'Timestamp when the client approved/confirmed their arrival. Set by client when they confirm they will arrive.';
COMMENT ON COLUMN public.grooming_appointments.manager_approved_arrival IS 'Timestamp when the manager approved the appointment arrival. Set by manager when they approve the appointment.';
COMMENT ON COLUMN public.grooming_appointments.treatment_started_at IS 'Timestamp when the treatment/grooming actually started. Set when staff begins working on the appointment.';
COMMENT ON COLUMN public.grooming_appointments.treatment_ended_at IS 'Timestamp when the treatment/grooming actually ended. Set when staff completes work on the appointment.';

-- Add the same columns to daycare_appointments for consistency
ALTER TABLE public.daycare_appointments
  ADD COLUMN IF NOT EXISTS client_approved_arrival TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS manager_approved_arrival TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS treatment_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS treatment_ended_at TIMESTAMP WITH TIME ZONE;

-- Add comments for daycare_appointments columns
COMMENT ON COLUMN public.daycare_appointments.client_approved_arrival IS 'Timestamp when the client approved/confirmed their arrival. Set by client when they confirm they will arrive.';
COMMENT ON COLUMN public.daycare_appointments.manager_approved_arrival IS 'Timestamp when the manager approved the appointment arrival. Set by manager when they approve the appointment.';
COMMENT ON COLUMN public.daycare_appointments.treatment_started_at IS 'Timestamp when the daycare service actually started. Set when staff begins the daycare service.';
COMMENT ON COLUMN public.daycare_appointments.treatment_ended_at IS 'Timestamp when the daycare service actually ended. Set when staff completes the daycare service.';

