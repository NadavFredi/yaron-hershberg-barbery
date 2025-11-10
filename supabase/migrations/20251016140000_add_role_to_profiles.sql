-- Add role field to profiles table to distinguish between customers and managers

BEGIN;

-- Create role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('customer', 'manager');
  END IF;
END;
$$;

-- Add role column to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'customer';

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Update existing policies comment
COMMENT ON COLUMN public.profiles.role IS 'User role: customer (לקוח) or manager (מנהל)';

COMMIT;

