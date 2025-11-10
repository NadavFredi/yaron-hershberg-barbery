-- Add client_id field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.profiles.client_id IS 'External client ID received from webhook API';
