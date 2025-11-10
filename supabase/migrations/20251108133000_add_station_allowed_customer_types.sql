-- Restrict stations to specific customer types for appointment booking
-- Provides per-station allow-list of customer types

BEGIN;

CREATE TABLE IF NOT EXISTS public.station_allowed_customer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  customer_type_id uuid NOT NULL REFERENCES public.customer_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, customer_type_id)
);

CREATE INDEX IF NOT EXISTS idx_station_allowed_customer_types_station
  ON public.station_allowed_customer_types(station_id);

CREATE INDEX IF NOT EXISTS idx_station_allowed_customer_types_customer_type
  ON public.station_allowed_customer_types(customer_type_id);

ALTER TABLE public.station_allowed_customer_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Allow managers to read station-customer-type restrictions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'station_allowed_customer_types'
      AND policyname = 'station_allowed_customer_types_select_manager'
  ) THEN
    CREATE POLICY station_allowed_customer_types_select_manager
      ON public.station_allowed_customer_types
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert restrictions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'station_allowed_customer_types'
      AND policyname = 'station_allowed_customer_types_insert_manager'
  ) THEN
    CREATE POLICY station_allowed_customer_types_insert_manager
      ON public.station_allowed_customer_types
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update restrictions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'station_allowed_customer_types'
      AND policyname = 'station_allowed_customer_types_update_manager'
  ) THEN
    CREATE POLICY station_allowed_customer_types_update_manager
      ON public.station_allowed_customer_types
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to delete restrictions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'station_allowed_customer_types'
      AND policyname = 'station_allowed_customer_types_delete_manager'
  ) THEN
    CREATE POLICY station_allowed_customer_types_delete_manager
      ON public.station_allowed_customer_types
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_allowed_customer_types TO authenticated;

COMMENT ON TABLE public.station_allowed_customer_types IS 'Allowed customer types per station for appointment booking';
COMMENT ON COLUMN public.station_allowed_customer_types.customer_type_id IS 'Customer type allowed to reserve appointments on the station';

COMMIT;


