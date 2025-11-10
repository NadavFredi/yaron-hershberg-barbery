
-- Create the services table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the stations table
CREATE TABLE IF NOT EXISTS public.stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  break_between_appointments INTEGER NOT NULL DEFAULT 15,
  google_calendar_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the breeds table
CREATE TABLE IF NOT EXISTS public.breeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the service_station_matrix table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.service_station_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  base_time_minutes INTEGER NOT NULL DEFAULT 60,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, station_id)
);

-- Create the breed_modifiers table for breed-specific time adjustments
CREATE TABLE IF NOT EXISTS public.breed_modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  breed_id UUID NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  time_modifier_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, breed_id)
);

-- Create the profiles table for user profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  client_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure unique name constraints for seed-friendly inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'services_name_key'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_name_key UNIQUE (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stations_name_key'
      AND conrelid = 'public.stations'::regclass
  ) THEN
    ALTER TABLE public.stations ADD CONSTRAINT stations_name_key UNIQUE (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'breeds_name_key'
      AND conrelid = 'public.breeds'::regclass
  ) THEN
    ALTER TABLE public.breeds ADD CONSTRAINT breeds_name_key UNIQUE (name);
  END IF;
END;
$$;

-- Enable Row Level Security
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_station_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breed_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is an admin interface)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND policyname = 'Allow all operations on services'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on services" ON public.services FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stations'
      AND policyname = 'Allow all operations on stations'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on stations" ON public.stations FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'breeds'
      AND policyname = 'Allow all operations on breeds'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on breeds" ON public.breeds FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_station_matrix'
      AND policyname = 'Allow all operations on service_station_matrix'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on service_station_matrix" ON public.service_station_matrix FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'breed_modifiers'
      AND policyname = 'Allow all operations on breed_modifiers'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on breed_modifiers" ON public.breed_modifiers FOR ALL USING (true)';
  END IF;
END;
$$;

-- Create policies for profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can insert their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id)';
  END IF;
END;
$$;

-- Enable the http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS "http";

-- Insert some sample data (idempotent upserts)
INSERT INTO public.services (name, description) VALUES
  ('תספורת מלאה', 'תספורת מלאה כולל רחצה וייבוש')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.services (name, description) VALUES
  ('רחצה זייבוש', 'רחצה וייבוש בלבד')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.services (name, description) VALUES
  ('גיזת ציפורניים', 'גיזת ציפורניים וטיפוח כפות')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.services (name, description) VALUES
  ('טיפוח מלא', 'שירות מלא כולל תספורת, רחצה וטיפוח')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.services (name, description) VALUES
  ('תספורת חלקית', 'תספורת חלקית או עיצוב מסוים')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.stations (name, is_active, break_between_appointments) VALUES
  ('עמדה 1', true, 15)
ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active, break_between_appointments = EXCLUDED.break_between_appointments;

INSERT INTO public.stations (name, is_active, break_between_appointments) VALUES
  ('עמדה 2', true, 15)
ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active, break_between_appointments = EXCLUDED.break_between_appointments;

INSERT INTO public.stations (name, is_active, break_between_appointments) VALUES
  ('עמדה 3', true, 20)
ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active, break_between_appointments = EXCLUDED.break_between_appointments;

INSERT INTO public.stations (name, is_active, break_between_appointments) VALUES
  ('עמדה 4', false, 15)
ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active, break_between_appointments = EXCLUDED.break_between_appointments;

INSERT INTO public.breeds (name) VALUES ('יורקשייר טרייר') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('גולדן רטריבר') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('לברדור') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('פודל') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('רועה גרמני') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('שיצו') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('מלטזי') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('בישון פריזה') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('קוקר ספנייל') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.breeds (name) VALUES ('צ׳יוואווה') ON CONFLICT (name) DO NOTHING;

-- Insert some sample service-station configurations if none exist
INSERT INTO public.service_station_matrix (service_id, station_id, base_time_minutes, price)
SELECT 
  s.id,
  st.id,
  CASE 
    WHEN s.name = 'תספורת מלאה' THEN 90
    WHEN s.name = 'רחצה זייבוש' THEN 45
    WHEN s.name = 'גיזת ציפורניים' THEN 15
    WHEN s.name = 'טיפוח מלא' THEN 120
    WHEN s.name = 'תספורת חלקית' THEN 60
    ELSE 60
  END as base_time,
  CASE 
    WHEN s.name = 'תספורת מלאה' THEN 150.00
    WHEN s.name = 'רחצה זייבוש' THEN 80.00
    WHEN s.name = 'גיזת ציפורניים' THEN 30.00
    WHEN s.name = 'טיפוח מלא' THEN 200.00
    WHEN s.name = 'תספורת חלקית' THEN 100.00
    ELSE 100.00
  END as price
FROM public.services s
CROSS JOIN public.stations st
WHERE st.is_active = true
ON CONFLICT (service_id, station_id) DO UPDATE 
  SET base_time_minutes = EXCLUDED.base_time_minutes,
      price = EXCLUDED.price;
