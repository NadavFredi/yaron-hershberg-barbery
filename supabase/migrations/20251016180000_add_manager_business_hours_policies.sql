-- Add RLS policies to allow managers to manage business_hours and station_unavailability
-- This enables the settings page to create/update/delete business hours and station unavailability

BEGIN;

-- Business hours policies for managers
DO $$
BEGIN
  -- Allow managers to select all business hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_hours' AND policyname = 'business_hours_select_manager'
  ) THEN
    CREATE POLICY business_hours_select_manager ON public.business_hours
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert business hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_hours' AND policyname = 'business_hours_insert_manager'
  ) THEN
    CREATE POLICY business_hours_insert_manager ON public.business_hours
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update business hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_hours' AND policyname = 'business_hours_update_manager'
  ) THEN
    CREATE POLICY business_hours_update_manager ON public.business_hours
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

  -- Allow managers to delete business hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_hours' AND policyname = 'business_hours_delete_manager'
  ) THEN
    CREATE POLICY business_hours_delete_manager ON public.business_hours
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

-- Station unavailability policies for managers
DO $$
BEGIN
  -- Allow managers to select all station unavailability records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_unavailability' AND policyname = 'station_unavailability_select_manager'
  ) THEN
    CREATE POLICY station_unavailability_select_manager ON public.station_unavailability
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert station unavailability records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_unavailability' AND policyname = 'station_unavailability_insert_manager'
  ) THEN
    CREATE POLICY station_unavailability_insert_manager ON public.station_unavailability
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update station unavailability records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_unavailability' AND policyname = 'station_unavailability_update_manager'
  ) THEN
    CREATE POLICY station_unavailability_update_manager ON public.station_unavailability
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

  -- Allow managers to delete station unavailability records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_unavailability' AND policyname = 'station_unavailability_delete_manager'
  ) THEN
    CREATE POLICY station_unavailability_delete_manager ON public.station_unavailability
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

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_unavailability TO authenticated;

COMMIT;

