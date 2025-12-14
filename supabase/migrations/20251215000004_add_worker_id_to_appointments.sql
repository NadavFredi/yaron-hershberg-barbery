-- Add worker_id to grooming_appointments table
ALTER TABLE public.grooming_appointments 
ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_worker ON public.grooming_appointments(worker_id) WHERE worker_id IS NOT NULL;
