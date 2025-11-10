-- Create station_working_hours table to support multiple shifts per day per station
-- Similar to business_hours but station-specific

BEGIN;

-- Create station_working_hours table
CREATE TABLE IF NOT EXISTS public.station_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  weekday text NOT NULL,
  open_time time NOT NULL,
  close_time time NOT NULL,
  shift_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(station_id, weekday, shift_order)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_station_working_hours_station_id ON public.station_working_hours(station_id);
CREATE INDEX IF NOT EXISTS idx_station_working_hours_weekday ON public.station_working_hours(weekday);
CREATE INDEX IF NOT EXISTS idx_station_working_hours_station_weekday_shift ON public.station_working_hours(station_id, weekday, shift_order);

-- Add trigger for updated_at
CREATE TRIGGER set_station_working_hours_updated_at BEFORE UPDATE ON public.station_working_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.station_working_hours ENABLE ROW LEVEL SECURITY;

-- Create manager policies (similar to business_hours)
DO $$
BEGIN
  -- Allow managers to select all station working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_working_hours' AND policyname = 'station_working_hours_select_manager'
  ) THEN
    CREATE POLICY station_working_hours_select_manager ON public.station_working_hours
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert station working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_working_hours' AND policyname = 'station_working_hours_insert_manager'
  ) THEN
    CREATE POLICY station_working_hours_insert_manager ON public.station_working_hours
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update station working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_working_hours' AND policyname = 'station_working_hours_update_manager'
  ) THEN
    CREATE POLICY station_working_hours_update_manager ON public.station_working_hours
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

  -- Allow managers to delete station working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_working_hours' AND policyname = 'station_working_hours_delete_manager'
  ) THEN
    CREATE POLICY station_working_hours_delete_manager ON public.station_working_hours
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

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_working_hours TO authenticated;

COMMENT ON TABLE public.station_working_hours IS 'Working hours for each station, supporting multiple shifts per day';
COMMENT ON COLUMN public.station_working_hours.shift_order IS 'סדר המשמרות באותו יום (0 = משמרת ראשונה, 1 = משמרת שנייה וכו)';

COMMIT;

