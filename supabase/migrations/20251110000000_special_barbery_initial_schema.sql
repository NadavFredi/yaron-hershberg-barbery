-- Yaron Hershberg Special Barbery: canonical schema
-- Fresh start focused on clients, treatment types, stations, and appointments.

-- Extensions -----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core reference tables -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treatment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color_hex TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  break_between_treatments_minutes INTEGER NOT NULL DEFAULT 15,
  slot_interval_minutes INTEGER NOT NULL DEFAULT 15,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS public.station_treatment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  treatment_type_id UUID NOT NULL REFERENCES public.treatment_types(id) ON DELETE CASCADE,
  custom_duration_minutes INTEGER,
  custom_price DECIMAL(10,2),
  is_available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(station_id, treatment_type_id)
);

CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  treatment_type_id UUID NOT NULL REFERENCES public.treatment_types(id) ON DELETE SET NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.station_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auth-linked profile ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Triggers to maintain updated_at ---------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_treatment_types
  BEFORE UPDATE ON public.treatment_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_stations
  BEFORE UPDATE ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_station_treatment_types
  BEFORE UPDATE ON public.station_treatment_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_station_unavailability
  BEFORE UPDATE ON public.station_unavailability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security ----------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies (open for now while admin app is built)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Allow all operations on clients'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on clients" ON public.clients FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'treatment_types' AND policyname = 'Allow all operations on treatment_types'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on treatment_types" ON public.treatment_types FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stations' AND policyname = 'Allow all operations on stations'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on stations" ON public.stations FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_treatment_types' AND policyname = 'Allow all operations on station_treatment_types'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on station_treatment_types" ON public.station_treatment_types FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments' AND policyname = 'Allow all operations on appointments'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on appointments" ON public.appointments FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_unavailability' AND policyname = 'Allow all operations on station_unavailability'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on station_unavailability" ON public.station_unavailability FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users manage their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users manage their own profile" ON public.profiles
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);';
  END IF;
END;
$$;

-- Seed data -------------------------------------------------------------------
INSERT INTO public.treatment_types (name, description, default_duration_minutes, default_price, display_order, color_hex)
VALUES
  ('טיפול עיצוב שיער מיוחד', 'עיצוב והתאמה אישית ללקוחות המספרה יוצאת הדופן של ירון הרשברג', 90, 450, 1, '#C084FC'),
  ('טיפול החלקה והזנה', 'החלקת שיער עמוקה עם תכשירים יוקרתיים', 120, 620, 2, '#60A5FA'),
  ('טיפול רענון מהיר', 'טיפול קצר להתחדשות והחזרת ברק', 45, 260, 3, '#34D399'),
  ('טיפול טיפוח זקן', 'עיצוב זקן ושפם מותאם אישית', 30, 180, 4, '#FBBF24')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    default_duration_minutes = EXCLUDED.default_duration_minutes,
    default_price = EXCLUDED.default_price,
    display_order = EXCLUDED.display_order,
    color_hex = EXCLUDED.color_hex,
    is_active = true;

INSERT INTO public.stations (name, description, break_between_treatments_minutes, slot_interval_minutes, display_order)
VALUES
  ('עמדת פרימיום 1', 'עמדה ראשית לעיצובי פרימיום', 15, 15, 1),
  ('עמדת פרימיום 2', 'עמדה ייעודית לטיפולי הזנה', 20, 20, 2),
  ('עמדת טיפוח זקן', 'תחנת טיפוח זקן ושפם', 10, 10, 3)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    break_between_treatments_minutes = EXCLUDED.break_between_treatments_minutes,
    slot_interval_minutes = EXCLUDED.slot_interval_minutes,
    display_order = EXCLUDED.display_order,
    is_active = true;

INSERT INTO public.station_treatment_types (station_id, treatment_type_id, custom_duration_minutes, custom_price, is_available)
SELECT
  s.id,
  t.id,
  NULL,
  NULL,
  true
FROM public.stations s
CROSS JOIN public.treatment_types t
ON CONFLICT (station_id, treatment_type_id) DO NOTHING;

-- Indexes ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_station ON public.appointments (station_id);
CREATE INDEX IF NOT EXISTS idx_appointments_treatment_type ON public.appointments (treatment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_start ON public.appointments (scheduled_start);

CREATE INDEX IF NOT EXISTS idx_station_unavailability_station ON public.station_unavailability (station_id);

