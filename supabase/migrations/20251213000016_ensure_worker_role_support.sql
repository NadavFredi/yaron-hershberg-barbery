-- Migration: Ensure profiles.role supports 'worker' value
-- This migration handles both cases: if role is TEXT (current schema) or ENUM (backup schema)

BEGIN;

-- Check if user_role enum exists and add 'worker' value if it does
DO $$
BEGIN
  -- Check if the enum type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    -- Check if 'worker' value already exists in the enum
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_enum 
      WHERE enumlabel = 'worker' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
      -- Add 'worker' to the enum
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'worker';
      RAISE NOTICE 'Added ''worker'' value to user_role enum';
    ELSE
      RAISE NOTICE 'Value ''worker'' already exists in user_role enum';
    END IF;
  ELSE
    RAISE NOTICE 'user_role enum does not exist, role column is likely TEXT';
  END IF;
END;
$$;

-- Ensure worker_is_active column exists with correct default
DO $$
BEGIN
  -- Check if worker_is_active column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'worker_is_active'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN worker_is_active BOOLEAN NOT NULL DEFAULT true;
    RAISE NOTICE 'Added worker_is_active column to profiles table';
  ELSE
    -- Ensure the default is true
    ALTER TABLE public.profiles 
    ALTER COLUMN worker_is_active SET DEFAULT true;
    
    -- Update any NULL values to true
    UPDATE public.profiles 
    SET worker_is_active = true 
    WHERE worker_is_active IS NULL;
    
    -- Make sure it's NOT NULL
    ALTER TABLE public.profiles 
    ALTER COLUMN worker_is_active SET NOT NULL;
    
    RAISE NOTICE 'Ensured worker_is_active column has correct default and constraints';
  END IF;
END;
$$;

-- Create index on role for faster queries (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Create index on worker_is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_profiles_worker_is_active ON public.profiles(worker_is_active);

-- Create composite index for common query pattern (role + worker_is_active)
CREATE INDEX IF NOT EXISTS idx_profiles_role_worker_active 
ON public.profiles(role, worker_is_active) 
WHERE role = 'worker';

COMMENT ON COLUMN public.profiles.role IS 'User role: customer (לקוח), manager (מנהל), or worker (עובד)';
COMMENT ON COLUMN public.profiles.worker_is_active IS 'Whether the worker is currently active (only relevant when role = worker)';

-- Add RLS policy to allow managers to view all profiles (especially workers)
-- First, create a function to check if current user is a manager (avoids circular dependency)
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role::text = 'manager'
  );
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;

-- Add RLS policy to allow managers to view all profiles
DO $$
BEGIN
  -- Drop existing policy if it exists to recreate it
  DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
  
  CREATE POLICY "Managers can view all profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
      -- Users can always view their own profile
      auth.uid() = id
      OR
      -- Managers can view all profiles
      public.is_manager()
    );
  
  RAISE NOTICE 'Created RLS policy: Managers can view all profiles';
END;
$$;

-- Allow managers to update worker profiles
DO $$
BEGIN
  -- Drop existing policy if it exists to recreate it
  DROP POLICY IF EXISTS "Managers can update worker profiles" ON public.profiles;
  
  CREATE POLICY "Managers can update worker profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      -- Users can update their own profile
      auth.uid() = id
      OR
      -- Managers can update worker profiles
      (public.is_manager() AND role::text = 'worker')
    )
    WITH CHECK (
      -- Users can update their own profile
      auth.uid() = id
      OR
      -- Managers can update worker profiles
      (public.is_manager() AND role::text = 'worker')
    );
  
  RAISE NOTICE 'Created RLS policy: Managers can update worker profiles';
END;
$$;

COMMIT;
