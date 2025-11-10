-- Add RLS policies to allow managers to manage daycare_capacity_limits
-- This enables the settings page to create/update/delete garden capacity limits

-- Ensure profiles infrastructure exists before creating policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role'
  ) THEN
    RAISE NOTICE 'Creating user_role enum for manager authorization policies.';
    CREATE TYPE public.user_role AS ENUM ('customer', 'manager');
  ELSE
    RAISE NOTICE 'user_role enum already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    RAISE NOTICE 'Creating profiles table for manager authorization policies.';
    CREATE TABLE public.profiles (
      id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT,
      phone_number TEXT,
      email TEXT,
      client_id TEXT,
      role public.user_role NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );
  ELSE
    RAISE NOTICE 'profiles table already exists.';
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN
      RAISE NOTICE 'Adding missing role column to profiles.';
      ALTER TABLE public.profiles
        ADD COLUMN role public.user_role NOT NULL DEFAULT 'customer';
    ELSE
      RAISE NOTICE 'profiles.role column already exists.';
    END IF;
  END IF;
END;
$$;

BEGIN;

-- Daycare capacity limits policies for managers
DO $$
BEGIN
  -- Allow managers to select all daycare capacity limits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_capacity_limits' AND policyname = 'daycare_capacity_limits_select_manager'
  ) THEN
    CREATE POLICY daycare_capacity_limits_select_manager ON public.daycare_capacity_limits
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert daycare capacity limits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_capacity_limits' AND policyname = 'daycare_capacity_limits_insert_manager'
  ) THEN
    CREATE POLICY daycare_capacity_limits_insert_manager ON public.daycare_capacity_limits
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update daycare capacity limits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_capacity_limits' AND policyname = 'daycare_capacity_limits_update_manager'
  ) THEN
    CREATE POLICY daycare_capacity_limits_update_manager ON public.daycare_capacity_limits
      FOR UPDATE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to delete daycare capacity limits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_capacity_limits' AND policyname = 'daycare_capacity_limits_delete_manager'
  ) THEN
    CREATE POLICY daycare_capacity_limits_delete_manager ON public.daycare_capacity_limits
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;
END;
$$;

COMMIT;
