-- Create tables for shift-level customer type restrictions
-- These allow different customer type restrictions per shift (working hour) within a station

-- Table for allowed customer types per shift
CREATE TABLE IF NOT EXISTS public.shift_allowed_customer_types (
  shift_id UUID NOT NULL REFERENCES public.station_working_hours(id) ON DELETE CASCADE,
  customer_type_id UUID NOT NULL REFERENCES public.customer_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_id, customer_type_id)
);

-- Table for blocked customer types per shift
CREATE TABLE IF NOT EXISTS public.shift_blocked_customer_types (
  shift_id UUID NOT NULL REFERENCES public.station_working_hours(id) ON DELETE CASCADE,
  customer_type_id UUID NOT NULL REFERENCES public.customer_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_id, customer_type_id)
);

-- Enable RLS
ALTER TABLE public.shift_allowed_customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_blocked_customer_types ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, to be tightened later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shift_allowed_customer_types'
      AND policyname = 'Allow all operations on shift_allowed_customer_types'
  ) THEN
    EXECUTE
      'CREATE POLICY "Allow all operations on shift_allowed_customer_types" ' ||
      'ON public.shift_allowed_customer_types FOR ALL USING (true) WITH CHECK (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shift_blocked_customer_types'
      AND policyname = 'Allow all operations on shift_blocked_customer_types'
  ) THEN
    EXECUTE
      'CREATE POLICY "Allow all operations on shift_blocked_customer_types" ' ||
      'ON public.shift_blocked_customer_types FOR ALL USING (true) WITH CHECK (true);';
  END IF;
END;
$$;

