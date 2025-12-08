-- Add missing tables that the codebase expects
-- This migration creates compatibility tables that map to the treatment-based schema
-- Note: "dog_id" in these tables actually references treatments.id (treatments = human clients)

-- Enums ----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_scope') THEN
    CREATE TYPE public.service_scope AS ENUM ('grooming', 'daycare', 'both');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
    CREATE TYPE public.waitlist_status AS ENUM ('active', 'inactive', 'fulfilled', 'cancelled');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daycare_service_type') THEN
    CREATE TYPE public.daycare_service_type AS ENUM ('full_day', 'trial', 'hourly');
  END IF;
END;
$$;

-- Breeds table (minimal - treatments use treatment_types, not breeds) ------
-- This is kept for compatibility but may not be used
CREATE TABLE IF NOT EXISTS public.breeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  airtable_id TEXT UNIQUE,
  size_class TEXT,
  min_groom_price NUMERIC(10,2),
  max_groom_price NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breeds_name ON public.breeds(name);

-- Dogs view (maps to treatments) --------------------------------------------
-- This view allows the code to query "dogs" but it actually uses treatments
CREATE OR REPLACE VIEW public.dogs AS
SELECT 
  t.id,
  t.customer_id,
  t.name,
  NULL::UUID as breed_id,  -- treatments don't have breeds
  CASE 
    WHEN t.gender = 'male' THEN 'male'::text
    WHEN t.gender = 'female' THEN 'female'::text
    ELSE 'unknown'::text
  END as gender,
  t.birth_date,
  t.notes as health_notes,
  NULL::TEXT as vet_name,
  NULL::TEXT as vet_phone,
  t.notes as staff_notes,
  t.is_small,
  NULL::BOOLEAN as aggression_risk,
  NULL::BOOLEAN as people_anxious,
  'not_required'::public.questionnaire_result as questionnaire_result,
  NULL::TEXT as image_url,
  NULL::TEXT as airtable_id,
  t.created_at,
  t.updated_at
FROM public.treatments t;

-- Daily notes table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_notes (
  date DATE PRIMARY KEY,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daycare waitlist table (maps treatment_id to dog_id for compatibility) ---
CREATE TABLE IF NOT EXISTS public.daycare_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,  -- dog_id = treatment_id
  service_scope public.service_scope NOT NULL DEFAULT 'daycare',
  status public.waitlist_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  requested_range JSONB,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_customer ON public.daycare_waitlist(customer_id);
CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_dog ON public.daycare_waitlist(dog_id);
CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_status ON public.daycare_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_dates ON public.daycare_waitlist(start_date, end_date);

-- Grooming appointments table (maps treatment_id to dog_id for compatibility)
CREATE TABLE IF NOT EXISTS public.grooming_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,  -- dog_id = treatment_id
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  appointment_kind public.appointment_kind NOT NULL DEFAULT 'business',
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  series_id TEXT,
  personal_reason TEXT,
  customer_notes TEXT,
  internal_notes TEXT,
  amount_due NUMERIC(10,2),
  billing_url TEXT,
  billing_triggered_at TIMESTAMP WITH TIME ZONE,
  pickup_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_grooming_appointments_customer ON public.grooming_appointments(customer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_dog ON public.grooming_appointments(dog_id, start_at);
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_station ON public.grooming_appointments(station_id, start_at) WHERE status <> 'cancelled';

-- Daycare appointments table (maps treatment_id to dog_id for compatibility)
CREATE TABLE IF NOT EXISTS public.daycare_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,  -- dog_id = treatment_id
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  service_type public.daycare_service_type NOT NULL DEFAULT 'full_day',
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  series_id TEXT,
  late_pickup_requested BOOLEAN,
  late_pickup_notes TEXT,
  amount_due NUMERIC(10,2),
  garden_trim_nails BOOLEAN,
  garden_brush BOOLEAN,
  garden_bath BOOLEAN,
  customer_notes TEXT,
  internal_notes TEXT,
  questionnaire_result public.questionnaire_result NOT NULL DEFAULT 'pending',
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_daycare_appointments_customer ON public.daycare_appointments(customer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_daycare_appointments_dog ON public.daycare_appointments(dog_id, start_at);
CREATE INDEX IF NOT EXISTS idx_daycare_appointments_station ON public.daycare_appointments(station_id, start_at) WHERE status <> 'cancelled';

-- Triggers to maintain updated_at -------------------------------------------
CREATE TRIGGER set_updated_at_daily_notes
  BEFORE UPDATE ON public.daily_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_daycare_waitlist
  BEFORE UPDATE ON public.daycare_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_grooming_appointments
  BEFORE UPDATE ON public.grooming_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_daycare_appointments
  BEFORE UPDATE ON public.daycare_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security ---------------------------------------------------------
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grooming_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_appointments ENABLE ROW LEVEL SECURITY;

-- Open policies for now (to be hardened later) -------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'breeds' AND policyname = 'Allow all operations on breeds'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on breeds" ON public.breeds FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_notes' AND policyname = 'Allow all operations on daily_notes'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on daily_notes" ON public.daily_notes FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_waitlist' AND policyname = 'Allow all operations on daycare_waitlist'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on daycare_waitlist" ON public.daycare_waitlist FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'Allow all operations on grooming_appointments'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on grooming_appointments" ON public.grooming_appointments FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'Allow all operations on daycare_appointments'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on daycare_appointments" ON public.daycare_appointments FOR ALL USING (true);';
  END IF;
END;
$$;
