-- Add active column to services table
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Update existing services to be active by default
UPDATE public.services
SET active = true
WHERE active IS NULL;

