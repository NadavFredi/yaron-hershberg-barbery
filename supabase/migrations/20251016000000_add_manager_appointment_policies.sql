-- Add RLS policies to allow authenticated users (managers) to manage appointments
-- This enables the manager schedule screen to create/update/delete appointments directly

BEGIN;

-- Grooming appointments policies for managers
DO $$
BEGIN
  -- Allow authenticated users to insert grooming appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_insert_authenticated'
  ) THEN
    CREATE POLICY grooming_appointments_insert_authenticated ON public.grooming_appointments
      FOR INSERT 
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to update grooming appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_update_authenticated'
  ) THEN
    CREATE POLICY grooming_appointments_update_authenticated ON public.grooming_appointments
      FOR UPDATE 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to delete grooming appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_delete_authenticated'
  ) THEN
    CREATE POLICY grooming_appointments_delete_authenticated ON public.grooming_appointments
      FOR DELETE 
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Daycare appointments policies for managers
DO $$
BEGIN
  -- Allow authenticated users to insert daycare appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_insert_authenticated'
  ) THEN
    CREATE POLICY daycare_appointments_insert_authenticated ON public.daycare_appointments
      FOR INSERT 
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to update daycare appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_update_authenticated'
  ) THEN
    CREATE POLICY daycare_appointments_update_authenticated ON public.daycare_appointments
      FOR UPDATE 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to delete daycare appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_delete_authenticated'
  ) THEN
    CREATE POLICY daycare_appointments_delete_authenticated ON public.daycare_appointments
      FOR DELETE 
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Combined appointments policies for managers
DO $$
BEGIN
  -- Allow authenticated users to manage combined appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'combined_appointments' AND policyname = 'combined_appointments_all_authenticated'
  ) THEN
    CREATE POLICY combined_appointments_all_authenticated ON public.combined_appointments
      FOR ALL 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grooming_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daycare_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combined_appointments TO authenticated;

COMMIT;

