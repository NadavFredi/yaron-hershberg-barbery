-- Update manager policies to check for manager role instead of allowing all authenticated users
-- This migration runs after the role column is added to profiles

BEGIN;

-- Drop old dogs policies that allowed all authenticated users
DROP POLICY IF EXISTS dogs_select_authenticated ON public.dogs;
DROP POLICY IF EXISTS dogs_insert_authenticated ON public.dogs;
DROP POLICY IF EXISTS dogs_update_authenticated ON public.dogs;
DROP POLICY IF EXISTS dogs_delete_authenticated ON public.dogs;

-- Drop old appointment policies that allowed all authenticated users
DROP POLICY IF EXISTS grooming_appointments_insert_authenticated ON public.grooming_appointments;
DROP POLICY IF EXISTS grooming_appointments_update_authenticated ON public.grooming_appointments;
DROP POLICY IF EXISTS grooming_appointments_delete_authenticated ON public.grooming_appointments;
DROP POLICY IF EXISTS daycare_appointments_insert_authenticated ON public.daycare_appointments;
DROP POLICY IF EXISTS daycare_appointments_update_authenticated ON public.daycare_appointments;
DROP POLICY IF EXISTS daycare_appointments_delete_authenticated ON public.daycare_appointments;
DROP POLICY IF EXISTS combined_appointments_all_authenticated ON public.combined_appointments;

-- Recreate dogs policies with role check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_select_manager'
  ) THEN
    CREATE POLICY dogs_select_manager ON public.dogs
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
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_insert_manager'
  ) THEN
    CREATE POLICY dogs_insert_manager ON public.dogs
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
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_update_manager'
  ) THEN
    CREATE POLICY dogs_update_manager ON public.dogs
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
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_delete_manager'
  ) THEN
    CREATE POLICY dogs_delete_manager ON public.dogs
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

-- Recreate grooming appointment policies with role check
DO $$
BEGIN
  -- Allow managers to select all grooming appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_select_manager'
  ) THEN
    CREATE POLICY grooming_appointments_select_manager ON public.grooming_appointments
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
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_insert_manager'
  ) THEN
    CREATE POLICY grooming_appointments_insert_manager ON public.grooming_appointments
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
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_update_manager'
  ) THEN
    CREATE POLICY grooming_appointments_update_manager ON public.grooming_appointments
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
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_delete_manager'
  ) THEN
    CREATE POLICY grooming_appointments_delete_manager ON public.grooming_appointments
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

-- Recreate daycare appointment policies with role check
DO $$
BEGIN
  -- Allow managers to select all daycare appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_select_manager'
  ) THEN
    CREATE POLICY daycare_appointments_select_manager ON public.daycare_appointments
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
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_insert_manager'
  ) THEN
    CREATE POLICY daycare_appointments_insert_manager ON public.daycare_appointments
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
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_update_manager'
  ) THEN
    CREATE POLICY daycare_appointments_update_manager ON public.daycare_appointments
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
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_delete_manager'
  ) THEN
    CREATE POLICY daycare_appointments_delete_manager ON public.daycare_appointments
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

-- Recreate combined appointments policy with role check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'combined_appointments' AND policyname = 'combined_appointments_all_manager'
  ) THEN
    CREATE POLICY combined_appointments_all_manager ON public.combined_appointments
      FOR ALL 
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
END;
$$;

COMMIT;

