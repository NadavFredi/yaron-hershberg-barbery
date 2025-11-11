-- Add base_price column for services if it is missing
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS base_price INTEGER NOT NULL DEFAULT 0;

-- Create service_station_matrix table to map services to stations with timing and price adjustments
CREATE TABLE IF NOT EXISTS public.service_station_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  base_time_minutes INTEGER NOT NULL DEFAULT 60,
  price_adjustment INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (service_id, station_id)
);

-- Ensure triggers keep updated_at in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_service_station_matrix'
  ) THEN
    CREATE TRIGGER set_updated_at_service_station_matrix
      BEFORE UPDATE ON public.service_station_matrix
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Enable RLS and allow all operations (to be tightened later if needed)
ALTER TABLE public.service_station_matrix ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_station_matrix'
      AND policyname = 'Allow all operations on service_station_matrix'
  ) THEN
    EXECUTE
      'CREATE POLICY "Allow all operations on service_station_matrix" ' ||
      'ON public.service_station_matrix FOR ALL USING (true) WITH CHECK (true);';
  END IF;
END;
$$;

-- Create treatmentType_modifiers table for breed/time adjustments per service
CREATE TABLE IF NOT EXISTS public."treatmentType_modifiers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  treatment_type_id UUID NOT NULL REFERENCES public.treatment_types(id) ON DELETE CASCADE,
  time_modifier_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (service_id, treatment_type_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_treatmentType_modifiers'
  ) THEN
    CREATE TRIGGER set_updated_at_treatmentType_modifiers
      BEFORE UPDATE ON public."treatmentType_modifiers"
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public."treatmentType_modifiers" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'treatmentType_modifiers'
      AND policyname = 'Allow all operations on treatmentType_modifiers'
  ) THEN
    EXECUTE
      'CREATE POLICY "Allow all operations on treatmentType_modifiers" ' ||
      'ON public."treatmentType_modifiers" FOR ALL USING (true) WITH CHECK (true);';
  END IF;
END;
$$;

