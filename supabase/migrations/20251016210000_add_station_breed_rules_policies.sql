-- Add RLS policies to allow managers to manage station_breed_rules
-- This enables the settings page to create/update station-breed rules

BEGIN;

-- Station breed rules policies for managers
DO $$
BEGIN
  -- Allow managers to select all station breed rules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_breed_rules' AND policyname = 'station_breed_rules_select_manager'
  ) THEN
    CREATE POLICY station_breed_rules_select_manager ON public.station_breed_rules
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert station breed rules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_breed_rules' AND policyname = 'station_breed_rules_insert_manager'
  ) THEN
    CREATE POLICY station_breed_rules_insert_manager ON public.station_breed_rules
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update station breed rules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_breed_rules' AND policyname = 'station_breed_rules_update_manager'
  ) THEN
    CREATE POLICY station_breed_rules_update_manager ON public.station_breed_rules
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

  -- Allow managers to delete station breed rules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_breed_rules' AND policyname = 'station_breed_rules_delete_manager'
  ) THEN
    CREATE POLICY station_breed_rules_delete_manager ON public.station_breed_rules
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;
END $$;

COMMIT;

