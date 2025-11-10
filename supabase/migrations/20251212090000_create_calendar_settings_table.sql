-- Create calendar_settings table to control how many days ahead the calendar opens
-- Includes RLS policies so only managers can view or modify the configuration

-- Ensure user_role enum and profiles table exist for manager authorization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role'
  ) THEN
    RAISE NOTICE 'Creating user_role enum for calendar settings policies.';
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
    RAISE NOTICE 'Creating profiles table for calendar settings policies.';
    CREATE TABLE public.profiles (
      id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT,
      phone_number TEXT,
      email TEXT,
      client_id TEXT,
      role public.user_role NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
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

-- Create calendar_settings table and supporting structures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'calendar_settings'
  ) THEN
    RAISE NOTICE 'Creating calendar_settings table.';
    CREATE TABLE public.calendar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      open_days_ahead INTEGER NOT NULL DEFAULT 30,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
    );
  ELSE
    RAISE NOTICE 'calendar_settings table already exists.';
    -- Ensure open_days_ahead column exists and is configured correctly
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'calendar_settings'
        AND column_name = 'open_days_ahead'
    ) THEN
      RAISE NOTICE 'Adding open_days_ahead column to calendar_settings.';
      ALTER TABLE public.calendar_settings
        ADD COLUMN open_days_ahead INTEGER NOT NULL DEFAULT 30;
    END IF;
  END IF;
END;
$$;

-- Ensure defaults and not-null constraints are enforced
ALTER TABLE public.calendar_settings
  ALTER COLUMN open_days_ahead SET NOT NULL,
  ALTER COLUMN open_days_ahead SET DEFAULT 30,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

-- Ensure RLS is enabled
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create trigger to maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_calendar_settings_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_calendar_settings_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      NEW.updated_at := timezone('utc', now());
      RETURN NEW;
    END;
    $function$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_calendar_settings_updated_at'
  ) THEN
    CREATE TRIGGER set_calendar_settings_updated_at
      BEFORE UPDATE ON public.calendar_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.set_calendar_settings_updated_at();
  END IF;
END;
$$;

-- Ensure only one row exists (singleton pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'calendar_settings'
      AND indexname = 'calendar_settings_singleton'
  ) THEN
    CREATE UNIQUE INDEX calendar_settings_singleton ON public.calendar_settings ((true));
  END IF;
END;
$$;

-- Seed a default configuration row if none exists
INSERT INTO public.calendar_settings (open_days_ahead)
SELECT 30
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_settings
);

-- Policies for managers to manage calendar settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_settings'
      AND policyname = 'calendar_settings_select_manager'
  ) THEN
    CREATE POLICY calendar_settings_select_manager ON public.calendar_settings
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_settings'
      AND policyname = 'calendar_settings_insert_manager'
  ) THEN
    CREATE POLICY calendar_settings_insert_manager ON public.calendar_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_settings'
      AND policyname = 'calendar_settings_update_manager'
  ) THEN
    CREATE POLICY calendar_settings_update_manager ON public.calendar_settings
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_settings'
      AND policyname = 'calendar_settings_delete_manager'
  ) THEN
    CREATE POLICY calendar_settings_delete_manager ON public.calendar_settings
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

