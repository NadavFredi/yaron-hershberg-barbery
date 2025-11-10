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

CREATE TYPE public.appointment_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'partial');
CREATE TYPE public.appointment_kind AS ENUM ('business', 'personal');
CREATE TYPE public.questionnaire_result AS ENUM ('not_required', 'pending', 'approved', 'rejected');

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
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  notes JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_days_ahead INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.calendar_settings (open_days_ahead)
SELECT 30
WHERE NOT EXISTS (SELECT 1 FROM public.calendar_settings);

CREATE TABLE IF NOT EXISTS public.custom_absence_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_text TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


-- Business operations ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday TEXT NOT NULL,
  shift_order INTEGER NOT NULL DEFAULT 0,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT business_hours_weekday_shift_order_unique UNIQUE (weekday, shift_order),
  CHECK (close_time > open_time)
);

CREATE TABLE IF NOT EXISTS public.station_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL,
  shift_order INTEGER NOT NULL DEFAULT 0,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (station_id, weekday, shift_order),
  CHECK (close_time > open_time)
);

CREATE TABLE IF NOT EXISTS public.daycare_capacity_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date DATE NOT NULL,
  trial_limit INTEGER NOT NULL DEFAULT 0,
  regular_limit INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(effective_date)
);

CREATE TABLE IF NOT EXISTS public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2),
  description TEXT,
  total_entries INTEGER,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT ticket_types_name_unique UNIQUE (name)
);

-- Auth-linked profile ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'client',
  worker_is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Triggers to maintain updated_at ---------------------------------------------
-- Customers & Treatments ------------------------------------------------------
CREATE TYPE public.treatment_gender AS ENUM ('male', 'female', 'unknown');

CREATE TYPE public.customer_class AS ENUM ('new', 'vip', 'standard', 'inactive');

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  phone_search TEXT,
  address TEXT,
  customer_type_id UUID,
  notes TEXT,
  classification public.customer_class NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(phone)
);

CREATE TABLE IF NOT EXISTS public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender public.treatment_gender NOT NULL DEFAULT 'unknown',
  treatment_type_id UUID REFERENCES public.treatment_types(id) ON DELETE SET NULL,
  birth_date DATE,
  notes TEXT,
  is_small BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.services (name, description, category, display_order, is_active)
VALUES
  ('grooming', 'טיפולי שיער במספרה', 'barbery', 1, true),
  ('special-care', 'טיפולי פרימיום מותאמים אישית', 'barbery', 2, true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category = EXCLUDED.category,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();


CREATE TABLE IF NOT EXISTS public.station_allowed_customer_types (
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  customer_type_id UUID NOT NULL REFERENCES public.customer_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (station_id, customer_type_id)
);

CREATE TABLE IF NOT EXISTS public.daycare_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  service_scope TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grooming_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  appointment_kind public.appointment_kind NOT NULL DEFAULT 'business',
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  customer_notes TEXT,
  internal_notes TEXT,
  amount_due NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daycare_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  service_type TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  customer_notes TEXT,
  internal_notes TEXT,
  questionnaire_result public.questionnaire_result NOT NULL DEFAULT 'pending',
  late_pickup_requested BOOLEAN,
  late_pickup_notes TEXT,
  garden_trim_nails BOOLEAN,
  garden_brush BOOLEAN,
  garden_bath BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.combined_appointments (
  grooming_appointment_id UUID REFERENCES public.grooming_appointments(id) ON DELETE CASCADE,
  daycare_appointment_id UUID REFERENCES public.daycare_appointments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (grooming_appointment_id, daycare_appointment_id)
);

CREATE TABLE IF NOT EXISTS public.proposed_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  service_type TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  code TEXT,
  title TEXT,
  summary TEXT,
  notes TEXT,
  reschedule_appointment_id UUID REFERENCES public.grooming_appointments(id) ON DELETE SET NULL,
  reschedule_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  reschedule_treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  reschedule_original_start_at TIMESTAMP WITH TIME ZONE,
  reschedule_original_end_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposed_meeting_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.proposed_meetings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  source TEXT,
  source_category_id UUID,
  last_notified_at TIMESTAMP WITH TIME ZONE,
  notification_count INTEGER NOT NULL DEFAULT 0,
  last_webhook_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposed_meeting_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.proposed_meetings(id) ON DELETE CASCADE,
  customer_type_id UUID REFERENCES public.customer_types(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

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

CREATE TRIGGER set_updated_at_customers
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_treatments
  BEFORE UPDATE ON public.treatments
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

CREATE TRIGGER set_updated_at_calendar_settings
  BEFORE UPDATE ON public.calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_business_hours
  BEFORE UPDATE ON public.business_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_station_working_hours
  BEFORE UPDATE ON public.station_working_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_daycare_capacity_limits
  BEFORE UPDATE ON public.daycare_capacity_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_ticket_types
  BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_custom_absence_reasons
  BEFORE UPDATE ON public.custom_absence_reasons
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

CREATE TRIGGER set_updated_at_customer_types
  BEFORE UPDATE ON public.customer_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_services
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_proposed_meetings
  BEFORE UPDATE ON public.proposed_meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_proposed_meeting_invites
  BEFORE UPDATE ON public.proposed_meeting_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_proposed_meeting_categories
  BEFORE UPDATE ON public.proposed_meeting_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security ----------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_capacity_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_absence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grooming_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_allowed_customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combined_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposed_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposed_meeting_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposed_meeting_categories ENABLE ROW LEVEL SECURITY;

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
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'Allow all operations on customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'treatments' AND policyname = 'Allow all operations on treatments'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on treatments" ON public.treatments FOR ALL USING (true);';
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
    WHERE schemaname = 'public' AND tablename = 'calendar_settings' AND policyname = 'Allow all operations on calendar_settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on calendar_settings" ON public.calendar_settings FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'custom_absence_reasons' AND policyname = 'Allow all operations on custom_absence_reasons'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on custom_absence_reasons" ON public.custom_absence_reasons FOR ALL USING (true);';
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_types' AND policyname = 'Allow all operations on customer_types'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on customer_types" ' ||
      'ON public.customer_types FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Allow all operations on services'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on services" ' ||
      'ON public.services FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_allowed_customer_types' AND policyname = 'Allow all operations on station_allowed_customer_types'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on station_allowed_customer_types" ' ||
      'ON public.station_allowed_customer_types FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'combined_appointments' AND policyname = 'Allow all operations on combined_appointments'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on combined_appointments" ' ||
      'ON public.combined_appointments FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proposed_meetings' AND policyname = 'Allow all operations on proposed_meetings'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on proposed_meetings" ' ||
      'ON public.proposed_meetings FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proposed_meeting_invites' AND policyname = 'Allow all operations on proposed_meeting_invites'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on proposed_meeting_invites" ' ||
      'ON public.proposed_meeting_invites FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proposed_meeting_categories' AND policyname = 'Allow all operations on proposed_meeting_categories'
  ) THEN
    EXECUTE '' ||
      'CREATE POLICY "Allow all operations on proposed_meeting_categories" ' ||
      'ON public.proposed_meeting_categories FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users manage their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users manage their own profile" ON public.profiles
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_hours' AND policyname = 'Allow all operations on business_hours'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on business_hours" ON public.business_hours FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'station_working_hours' AND policyname = 'Allow all operations on station_working_hours'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on station_working_hours" ON public.station_working_hours FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_capacity_limits' AND policyname = 'Allow all operations on daycare_capacity_limits'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on daycare_capacity_limits" ON public.daycare_capacity_limits FOR ALL USING (true);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ticket_types' AND policyname = 'Allow all operations on ticket_types'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow all operations on ticket_types" ON public.ticket_types FOR ALL USING (true);';
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
CREATE INDEX IF NOT EXISTS idx_business_hours_weekday_shift ON public.business_hours (weekday, shift_order);
CREATE INDEX IF NOT EXISTS idx_station_working_hours_station_weekday_shift
  ON public.station_working_hours (station_id, weekday, shift_order);
CREATE INDEX IF NOT EXISTS idx_daycare_capacity_limits_effective_date ON public.daycare_capacity_limits (effective_date);

