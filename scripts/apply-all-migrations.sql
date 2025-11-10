-- =========================================
-- Migration: 20250119000000_add_dog_categories.sql
-- =========================================
-- Create tables for dog types and categories
-- This migration adds support for main categories (dog types) and sub categories

BEGIN;

-- Create dog_types table (סוג כלב)
CREATE TABLE IF NOT EXISTS public.dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_types_name 
  ON public.dog_types(name);

-- Trigger for updated_at
CREATE TRIGGER set_dog_types_updated_at 
  BEFORE UPDATE ON public.dog_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create dog_categories table (קטגוריה)
CREATE TABLE IF NOT EXISTS public.dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_categories_name 
  ON public.dog_categories(name);

-- Trigger for updated_at
CREATE TRIGGER set_dog_categories_updated_at 
  BEFORE UPDATE ON public.dog_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create junction table for breeds and dog_types (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  dog_type_id uuid NOT NULL REFERENCES public.dog_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_type_id)
);

CREATE INDEX IF NOT EXISTS idx_breed_dog_types_breed_id 
  ON public.breed_dog_types(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_types_dog_type_id 
  ON public.breed_dog_types(dog_type_id);

-- Create junction table for breeds and dog_categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  dog_category_id uuid NOT NULL REFERENCES public.dog_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_category_id)
);

CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_breed_id 
  ON public.breed_dog_categories(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_dog_category_id 
  ON public.breed_dog_categories(dog_category_id);

-- RLS policies for dog_types
ALTER TABLE public.dog_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY dog_types_select_manager 
  ON public.dog_types
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_types_insert_manager 
  ON public.dog_types
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_types_update_manager 
  ON public.dog_types
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_types_delete_manager 
  ON public.dog_types
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- RLS policies for dog_categories
ALTER TABLE public.dog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY dog_categories_select_manager 
  ON public.dog_categories
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_categories_insert_manager 
  ON public.dog_categories
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_categories_update_manager 
  ON public.dog_categories
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_categories_delete_manager 
  ON public.dog_categories
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- RLS policies for breed_dog_types
ALTER TABLE public.breed_dog_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY breed_dog_types_select_manager 
  ON public.breed_dog_types
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_types_insert_manager 
  ON public.breed_dog_types
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_types_delete_manager 
  ON public.breed_dog_types
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- RLS policies for breed_dog_categories
ALTER TABLE public.breed_dog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY breed_dog_categories_select_manager 
  ON public.breed_dog_categories
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_categories_insert_manager 
  ON public.breed_dog_categories
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_categories_delete_manager 
  ON public.breed_dog_categories
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

COMMIT;



-- =========================================
-- Migration: 20251109123000_add_station_slot_interval.sql
-- =========================================

ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER NOT NULL DEFAULT 60;

UPDATE public.stations
SET slot_interval_minutes = 60
WHERE slot_interval_minutes IS NULL;

-- =========================================
-- Migration: 20250625232602_initial_schema.sql
-- =========================================

-- Create the services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the stations table
CREATE TABLE public.stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  break_between_appointments INTEGER NOT NULL DEFAULT 15,
  slot_interval_minutes INTEGER NOT NULL DEFAULT 60,
  google_calendar_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the breeds table
CREATE TABLE public.breeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create the service_station_matrix table (many-to-many relationship)
CREATE TABLE public.service_station_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  base_time_minutes INTEGER NOT NULL DEFAULT 60,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, station_id)
);

-- Create the breed_modifiers table for breed-specific time adjustments
CREATE TABLE public.breed_modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  breed_id UUID NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  time_modifier_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, breed_id)
);

-- Create the profiles table for user profile information
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  client_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_station_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breed_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is an admin interface)
CREATE POLICY "Allow all operations on services" ON public.services FOR ALL USING (true);
CREATE POLICY "Allow all operations on stations" ON public.stations FOR ALL USING (true);
CREATE POLICY "Allow all operations on breeds" ON public.breeds FOR ALL USING (true);
CREATE POLICY "Allow all operations on service_station_matrix" ON public.service_station_matrix FOR ALL USING (true);
CREATE POLICY "Allow all operations on breed_modifiers" ON public.breed_modifiers FOR ALL USING (true);

-- Create policies for profiles table
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Enable the http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS "http";

-- Insert some sample data
INSERT INTO public.services (name, description) VALUES
  ('תספורת מלאה', 'תספורת מלאה כולל רחצה וייבוש'),
  ('רחצה זייבוש', 'רחצה וייבוש בלבד'),
  ('גיזת ציפורניים', 'גיזת ציפורניים וטיפוח כפות'),
  ('טיפוח מלא', 'שירות מלא כולל תספורת, רחצה וטיפוח'),
  ('תספורת חלקית', 'תספורת חלקית או עיצוב מסוים');

INSERT INTO public.stations (name, is_active, break_between_appointments, slot_interval_minutes) VALUES
  ('עמדה 1', true, 15, 60),
  ('עמדה 2', true, 15, 60),
  ('עמדה 3', true, 20, 60),
  ('עמדה 4', false, 15, 60);

INSERT INTO public.breeds (name) VALUES
  ('יורקשייר טרייר'),
  ('גולדן רטריבר'),
  ('לברדור'),
  ('פודל'),
  ('רועה גרמני'),
  ('שיצו'),
  ('מלטזי'),
  ('בישון פריזה'),
  ('קוקר ספנייל'),
  ('צ׳יוואווה');

-- Insert some sample service-station configurations
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
WHERE st.is_active = true;


-- =========================================
-- Migration: 20250625232603_add_client_id_to_profiles.sql
-- =========================================
-- Add client_id field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.profiles.client_id IS 'External client ID received from webhook API';


-- =========================================
-- Migration: 20250925000000_fix_profiles_rls.sql
-- =========================================
-- Fix profiles table RLS policies
-- This migration ensures proper RLS policies are in place for the profiles table

-- First, ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create proper RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions to service role (for signup function)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;


-- =========================================
-- Migration: 20251015120000_expand_core_schema.sql
-- =========================================
-- Expand core schema to mirror Airtable data model in Supabase
-- This migration introduces enums, tables, and policies required for the migration effort.

BEGIN;

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Shared enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_class') THEN
    CREATE TYPE public.customer_class AS ENUM ('extra_vip', 'vip', 'existing', 'new');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dog_gender') THEN
    CREATE TYPE public.dog_gender AS ENUM ('male', 'female');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE public.appointment_status AS ENUM ('pending', 'approved', 'cancelled', 'matched');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'partial');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_category') THEN
    CREATE TYPE public.service_category AS ENUM ('grooming', 'daycare', 'retail');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_scope') THEN
    CREATE TYPE public.service_scope AS ENUM ('grooming', 'daycare', 'both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_kind') THEN
    CREATE TYPE public.appointment_kind AS ENUM ('business', 'personal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questionnaire_result') THEN
    CREATE TYPE public.questionnaire_result AS ENUM ('not_required', 'pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'absence_reason') THEN
    CREATE TYPE public.absence_reason AS ENUM ('sick', 'vacation', 'ad_hoc');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daycare_service_type') THEN
    CREATE TYPE public.daycare_service_type AS ENUM ('full_day', 'trial', 'hourly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
    CREATE TYPE public.waitlist_status AS ENUM ('active', 'fulfilled', 'cancelled');
  END IF;
END;
$$;

-- Helper function for automatic timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  gov_id text,
  address text,
  classification public.customer_class NOT NULL DEFAULT 'new',
  send_invoice boolean NOT NULL DEFAULT false,
  whatsapp_link text,
  phone_search text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_unique UNIQUE (phone)
);
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON public.customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_search_trgm
  ON public.customers USING gin (phone_search gin_trgm_ops);

-- Breeds enrichment
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS airtable_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS size_class text,
  ADD COLUMN IF NOT EXISTS requires_staff_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_groom_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS max_groom_price numeric(10,2);

-- Dogs table
CREATE TABLE IF NOT EXISTS public.dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender public.dog_gender NOT NULL DEFAULT 'male',
  breed_id uuid REFERENCES public.breeds(id),
  birth_date date,
  health_notes text,
  vet_name text,
  vet_phone text,
  staff_notes text,
  is_small boolean,
  aggression_risk boolean,
  people_anxious boolean,
  questionnaire_result public.questionnaire_result NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dogs_customer ON public.dogs(customer_id);
CREATE INDEX IF NOT EXISTS idx_dogs_name_trgm ON public.dogs USING gin (name gin_trgm_ops);

-- Garden questionnaires
CREATE TABLE IF NOT EXISTS public.garden_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  aggressive_towards_dogs boolean,
  bites_people boolean,
  terms_accepted boolean,
  photo_url text,
  storage_object text,
  staff_reviewed_by uuid REFERENCES public.profiles(id),
  staff_comment text,
  result public.questionnaire_result NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_garden_questionnaires_dog ON public.garden_questionnaires(dog_id);

-- Services adjustments
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category public.service_category NOT NULL DEFAULT 'grooming',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Stations adjustments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stations'
      AND column_name = 'google_calendar_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.stations RENAME COLUMN google_calendar_id TO calendar_id';
  END IF;
END;
$$;
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS work_start time,
  ADD COLUMN IF NOT EXISTS work_end time,
  ADD COLUMN IF NOT EXISTS working_days text[];

-- Station unavailability
CREATE TABLE IF NOT EXISTS public.station_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  reason public.absence_reason,
  notes jsonb,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_station_unavailability_station
  ON public.station_unavailability(station_id, start_time);

-- Daycare appointments
CREATE TABLE IF NOT EXISTS public.daycare_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.stations(id),
  status public.appointment_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  service_type public.daycare_service_type NOT NULL DEFAULT 'full_day',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  series_id text,
  late_pickup_requested boolean,
  late_pickup_notes text,
  amount_due numeric(10,2),
  garden_trim_nails boolean,
  garden_brush boolean,
  garden_bath boolean,
  customer_notes text,
  internal_notes text,
  questionnaire_result public.questionnaire_result NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_daycare_appointments_customer
  ON public.daycare_appointments(customer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_daycare_appointments_dog
  ON public.daycare_appointments(dog_id, start_at);
CREATE INDEX IF NOT EXISTS idx_daycare_appointments_station
  ON public.daycare_appointments(station_id, start_at) WHERE status <> 'cancelled';

-- Grooming appointments
CREATE TABLE IF NOT EXISTS public.grooming_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  station_id uuid REFERENCES public.stations(id),
  status public.appointment_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  appointment_kind public.appointment_kind NOT NULL DEFAULT 'business',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  series_id text,
  personal_reason text,
  customer_notes text,
  internal_notes text,
  amount_due numeric(10,2),
  billing_url text,
  billing_triggered_at timestamptz,
  pickup_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_customer
  ON public.grooming_appointments(customer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_dog
  ON public.grooming_appointments(dog_id, start_at);
CREATE INDEX IF NOT EXISTS idx_grooming_appointments_station
  ON public.grooming_appointments(station_id, start_at) WHERE status <> 'cancelled';

-- Combined appointments mapping
CREATE TABLE IF NOT EXISTS public.combined_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grooming_appointment_id uuid REFERENCES public.grooming_appointments(id) ON DELETE CASCADE,
  daycare_appointment_id uuid REFERENCES public.daycare_appointments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grooming_appointment_id, daycare_appointment_id)
);

-- Daycare waitlist
CREATE TABLE IF NOT EXISTS public.daycare_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  service_scope public.service_scope NOT NULL DEFAULT 'daycare',
  status public.waitlist_status NOT NULL DEFAULT 'active',
  start_date date NOT NULL,
  end_date date,
  requested_range daterange GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_customer
  ON public.daycare_waitlist(customer_id);
CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_dog
  ON public.daycare_waitlist(dog_id);
CREATE INDEX IF NOT EXISTS idx_daycare_waitlist_range
  ON public.daycare_waitlist USING gist (requested_range);

-- Ticket types and tickets
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  name text NOT NULL,
  price numeric(10,2),
  description text,
  total_entries integer,
  is_unlimited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_types_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  ticket_type_id uuid REFERENCES public.ticket_types(id),
  expires_on date,
  total_entries integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON public.tickets(customer_id);

CREATE TABLE IF NOT EXISTS public.ticket_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  dog_id uuid REFERENCES public.dogs(id) ON DELETE SET NULL,
  units_used numeric(6,2) NOT NULL DEFAULT 1,
  grooming_appointment_id uuid REFERENCES public.grooming_appointments(id) ON DELETE SET NULL,
  daycare_appointment_id uuid REFERENCES public.daycare_appointments(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_usages_ticket ON public.ticket_usages(ticket_id);

-- Credit tokens and payments
CREATE TABLE IF NOT EXISTS public.credit_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider text,
  token text,
  cvv text,
  last4 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  status public.payment_status NOT NULL DEFAULT 'unpaid',
  method text,
  token_id uuid REFERENCES public.credit_tokens(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);

CREATE TABLE IF NOT EXISTS public.appointment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  grooming_appointment_id uuid REFERENCES public.grooming_appointments(id) ON DELETE CASCADE,
  daycare_appointment_id uuid REFERENCES public.daycare_appointments(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (grooming_appointment_id IS NOT NULL OR daycare_appointment_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_appointment_payments_payment ON public.appointment_payments(payment_id);

-- Products and orders
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  name text NOT NULL,
  brand text,
  category text,
  stock_quantity integer,
  cost_price numeric(10,2),
  bundle_price numeric(10,2),
  retail_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  grooming_appointment_id uuid REFERENCES public.grooming_appointments(id) ON DELETE SET NULL,
  daycare_appointment_id uuid REFERENCES public.daycare_appointments(id) ON DELETE SET NULL,
  status text,
  subtotal numeric(10,2),
  total numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- Station breed rules
CREATE TABLE IF NOT EXISTS public.station_breed_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  breed_id uuid REFERENCES public.breeds(id) ON DELETE CASCADE,
  duration_modifier_minutes integer DEFAULT 0,
  price_modifier numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, breed_id)
);

-- Capacity limits and business hours
CREATE TABLE IF NOT EXISTS public.daycare_capacity_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  trial_limit integer NOT NULL DEFAULT 0,
  regular_limit integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(effective_date)
);

CREATE TABLE IF NOT EXISTS public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday text NOT NULL,
  open_time time NOT NULL,
  close_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(weekday)
);

-- Triggers for updated_at
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_dogs_updated_at BEFORE UPDATE ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_garden_questionnaires_updated_at BEFORE UPDATE ON public.garden_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_station_unavailability_updated_at BEFORE UPDATE ON public.station_unavailability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_daycare_appointments_updated_at BEFORE UPDATE ON public.daycare_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_grooming_appointments_updated_at BEFORE UPDATE ON public.grooming_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_daycare_waitlist_updated_at BEFORE UPDATE ON public.daycare_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_ticket_types_updated_at BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_credit_tokens_updated_at BEFORE UPDATE ON public.credit_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_order_items_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_station_breed_rules_updated_at BEFORE UPDATE ON public.station_breed_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_daycare_capacity_limits_updated_at BEFORE UPDATE ON public.daycare_capacity_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_business_hours_updated_at BEFORE UPDATE ON public.business_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS and policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grooming_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combined_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_breed_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_capacity_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Customer policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_select_self'
  ) THEN
    EXECUTE 'CREATE POLICY customers_select_self ON public.customers FOR SELECT USING (auth.uid() = auth_user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_update_self'
  ) THEN
    EXECUTE 'CREATE POLICY customers_update_self ON public.customers FOR UPDATE USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_insert_self'
  ) THEN
    EXECUTE 'CREATE POLICY customers_insert_self ON public.customers FOR INSERT WITH CHECK (auth.uid() = auth_user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY customers_service_role_all ON public.customers FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END;
$$;

-- Dog policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY dogs_select_self ON public.dogs
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_modify_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY dogs_modify_self ON public.dogs
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_insert_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY dogs_insert_self ON public.dogs
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY dogs_service_role_all ON public.dogs FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END;
$$;

-- Generic service-role policies for operational tables
DO $$
DECLARE
  policy_tables text[] := ARRAY[
    'station_unavailability',
    'daycare_appointments',
    'grooming_appointments',
    'combined_appointments',
    'daycare_waitlist',
    'ticket_types',
    'tickets',
    'ticket_usages',
    'credit_tokens',
    'payments',
    'appointment_payments',
    'products',
    'orders',
    'order_items',
    'station_breed_rules',
    'daycare_capacity_limits',
    'business_hours',
    'garden_questionnaires'
  ];
  table_name text;
  policy_name text;
  policy_stmt text;
BEGIN
  FOREACH table_name IN ARRAY policy_tables
  LOOP
    policy_name := 'service_role_full_access_' || table_name;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
    ) THEN
      policy_stmt := format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        policy_name,
        table_name
      );
      EXECUTE policy_stmt;
    END IF;
  END LOOP;
END;
$$;

COMMIT;


-- =========================================
-- Migration: 20251015123000_extend_customer_rls.sql
-- =========================================
-- Grant customers the ability to manage their own records after moving off Airtable

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_delete_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY dogs_delete_self ON public.dogs
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY daycare_appointments_select_self ON public.daycare_appointments
        FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.dogs d
            JOIN public.customers c ON c.id = d.customer_id
            WHERE d.id = dog_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY grooming_appointments_select_self ON public.grooming_appointments
        FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.dogs d
            JOIN public.customers c ON c.id = d.customer_id
            WHERE d.id = dog_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;

COMMIT;


-- =========================================
-- Migration: 20251016000000_add_manager_appointment_policies.sql
-- =========================================
-- Add RLS policies to allow authenticated users (managers) to manage appointments
-- This enables the manager schedule screen to create/update/delete appointments directly

BEGIN;

-- Grooming appointments policies for managers
DO $$
BEGIN
  -- Allow authenticated users to insert grooming appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_insert_authenticated'
  ) THEN
    CREATE POLICY grooming_appointments_insert_authenticated ON public.grooming_appointments
      FOR INSERT 
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to update grooming appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_update_authenticated'
  ) THEN
    CREATE POLICY grooming_appointments_update_authenticated ON public.grooming_appointments
      FOR UPDATE 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to delete grooming appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_delete_authenticated'
  ) THEN
    CREATE POLICY grooming_appointments_delete_authenticated ON public.grooming_appointments
      FOR DELETE 
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Daycare appointments policies for managers
DO $$
BEGIN
  -- Allow authenticated users to insert daycare appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_insert_authenticated'
  ) THEN
    CREATE POLICY daycare_appointments_insert_authenticated ON public.daycare_appointments
      FOR INSERT 
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to update daycare appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_update_authenticated'
  ) THEN
    CREATE POLICY daycare_appointments_update_authenticated ON public.daycare_appointments
      FOR UPDATE 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to delete daycare appointments (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_delete_authenticated'
  ) THEN
    CREATE POLICY daycare_appointments_delete_authenticated ON public.daycare_appointments
      FOR DELETE 
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Combined appointments policies for managers
DO $$
BEGIN
  -- Allow authenticated users to manage combined appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'combined_appointments' AND policyname = 'combined_appointments_all_authenticated'
  ) THEN
    CREATE POLICY combined_appointments_all_authenticated ON public.combined_appointments
      FOR ALL 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grooming_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daycare_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combined_appointments TO authenticated;

COMMIT;



-- =========================================
-- Migration: 20251016130000_add_manager_dogs_policies.sql
-- =========================================
-- Add RLS policies to allow authenticated users (managers) to manage dogs
-- NOTE: This is a temporary migration that will be replaced by 20251016150000_update_manager_policies_with_role.sql
-- once the role column is added to profiles. It allows all authenticated users for now.
-- This enables managers to create/update/delete dogs for any customer

BEGIN;

-- Dogs policies for managers (temporary - will be replaced with role-based checks)
DO $$
BEGIN
  -- Allow authenticated users to select all dogs (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_select_authenticated'
  ) THEN
    CREATE POLICY dogs_select_authenticated ON public.dogs
      FOR SELECT 
      TO authenticated
      USING (true);
  END IF;

  -- Allow authenticated users to insert dogs for any customer (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_insert_authenticated'
  ) THEN
    CREATE POLICY dogs_insert_authenticated ON public.dogs
      FOR INSERT 
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to update dogs for any customer (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_update_authenticated'
  ) THEN
    CREATE POLICY dogs_update_authenticated ON public.dogs
      FOR UPDATE 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to delete dogs for any customer (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_delete_authenticated'
  ) THEN
    CREATE POLICY dogs_delete_authenticated ON public.dogs
      FOR DELETE 
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dogs TO authenticated;

COMMIT;



-- =========================================
-- Migration: 20251016140000_add_role_to_profiles.sql
-- =========================================
-- Add role field to profiles table to distinguish between customers and managers

BEGIN;

-- Create role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('customer', 'manager');
  END IF;
END;
$$;

-- Add role column to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'customer';

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Update existing policies comment
COMMENT ON COLUMN public.profiles.role IS 'User role: customer (לקוח) or manager (מנהל)';

COMMIT;



-- =========================================
-- Migration: 20251016150000_update_manager_policies_with_role.sql
-- =========================================
-- Update manager policies to check for manager role instead of allowing all authenticated users
-- This migration runs after the role column is added to profiles

BEGIN;

-- Drop old dogs policies that allowed all authenticated users
DROP POLICY IF EXISTS dogs_select_authenticated ON public.dogs;
DROP POLICY IF EXISTS dogs_insert_authenticated ON public.dogs;
DROP POLICY IF EXISTS dogs_update_authenticated ON public.dogs;
DROP POLICY IF EXISTS dogs_delete_authenticated ON public.dogs;

-- Drop old appointment policies that allowed all authenticated users
DROP POLICY IF EXISTS grooming_appointments_insert_authenticated ON public.grooming_appointments;
DROP POLICY IF EXISTS grooming_appointments_update_authenticated ON public.grooming_appointments;
DROP POLICY IF EXISTS grooming_appointments_delete_authenticated ON public.grooming_appointments;
DROP POLICY IF EXISTS daycare_appointments_insert_authenticated ON public.daycare_appointments;
DROP POLICY IF EXISTS daycare_appointments_update_authenticated ON public.daycare_appointments;
DROP POLICY IF EXISTS daycare_appointments_delete_authenticated ON public.daycare_appointments;
DROP POLICY IF EXISTS combined_appointments_all_authenticated ON public.combined_appointments;

-- Recreate dogs policies with role check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_select_manager'
  ) THEN
    CREATE POLICY dogs_select_manager ON public.dogs
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_insert_manager'
  ) THEN
    CREATE POLICY dogs_insert_manager ON public.dogs
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_update_manager'
  ) THEN
    CREATE POLICY dogs_update_manager ON public.dogs
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_delete_manager'
  ) THEN
    CREATE POLICY dogs_delete_manager ON public.dogs
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

-- Recreate grooming appointment policies with role check
DO $$
BEGIN
  -- Allow managers to select all grooming appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_select_manager'
  ) THEN
    CREATE POLICY grooming_appointments_select_manager ON public.grooming_appointments
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_insert_manager'
  ) THEN
    CREATE POLICY grooming_appointments_insert_manager ON public.grooming_appointments
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_update_manager'
  ) THEN
    CREATE POLICY grooming_appointments_update_manager ON public.grooming_appointments
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_delete_manager'
  ) THEN
    CREATE POLICY grooming_appointments_delete_manager ON public.grooming_appointments
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

-- Recreate daycare appointment policies with role check
DO $$
BEGIN
  -- Allow managers to select all daycare appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_select_manager'
  ) THEN
    CREATE POLICY daycare_appointments_select_manager ON public.daycare_appointments
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_insert_manager'
  ) THEN
    CREATE POLICY daycare_appointments_insert_manager ON public.daycare_appointments
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_update_manager'
  ) THEN
    CREATE POLICY daycare_appointments_update_manager ON public.daycare_appointments
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_delete_manager'
  ) THEN
    CREATE POLICY daycare_appointments_delete_manager ON public.daycare_appointments
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

-- Recreate combined appointments policy with role check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'combined_appointments' AND policyname = 'combined_appointments_all_manager'
  ) THEN
    CREATE POLICY combined_appointments_all_manager ON public.combined_appointments
      FOR ALL 
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
END;
$$;

COMMIT;



-- =========================================
-- Migration: 20251016160000_add_manager_customers_policies.sql
-- =========================================
-- Add RLS policies to allow managers to manage customers
-- This enables managers to view, insert, update customers for the manager schedule

BEGIN;

-- Customer policies for managers
DO $$
BEGIN
  -- Allow managers to select all customers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_select_manager'
  ) THEN
    CREATE POLICY customers_select_manager ON public.customers
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert customers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_insert_manager'
  ) THEN
    CREATE POLICY customers_insert_manager ON public.customers
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update any customer
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_update_manager'
  ) THEN
    CREATE POLICY customers_update_manager ON public.customers
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
END;
$$;

COMMIT;



-- =========================================
-- Migration: 20251016165000_add_settings_fields.sql
-- =========================================
-- Migration to add settings-related fields to breeds table
-- This migration adds hourly_price, notes, and remote_booking_allowed fields

BEGIN;

-- Add hourly_price to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS hourly_price numeric(10,2);

-- Add notes to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS notes text;

-- Add remote_booking_allowed to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS remote_booking_allowed boolean NOT NULL DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_breeds_remote_booking ON public.breeds(remote_booking_allowed);

COMMENT ON COLUMN public.breeds.hourly_price IS 'מחיר שעתי לגזע זה';
COMMENT ON COLUMN public.breeds.notes IS 'הערות נוספות על הגזע';
COMMENT ON COLUMN public.breeds.remote_booking_allowed IS 'האם לקוחות יכולים לקבוע תור מרחוק עבור גזע זה';

COMMIT;



-- =========================================
-- Migration: 20251016170000_update_business_hours_for_shifts.sql
-- =========================================
-- Migration to support multiple shifts per day in business_hours table
-- Remove unique constraint on weekday and add shift_order field

BEGIN;

-- Drop the unique constraint on weekday
ALTER TABLE public.business_hours DROP CONSTRAINT IF EXISTS business_hours_weekday_key;

-- Add shift_order column to support multiple shifts per day
ALTER TABLE public.business_hours
  ADD COLUMN IF NOT EXISTS shift_order integer NOT NULL DEFAULT 0;

-- Create a composite unique constraint on (weekday, shift_order)
ALTER TABLE public.business_hours
  ADD CONSTRAINT business_hours_weekday_shift_order_unique UNIQUE (weekday, shift_order);

-- Create index for faster lookups by weekday
CREATE INDEX IF NOT EXISTS idx_business_hours_weekday_shift ON public.business_hours(weekday, shift_order);

COMMENT ON COLUMN public.business_hours.shift_order IS 'סדר המשמרות באותו יום (0 = משמרת ראשונה, 1 = משמרת שנייה וכו)';

COMMIT;



-- =========================================
-- Migration: 20251016180000_add_manager_business_hours_policies.sql
-- =========================================
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



-- =========================================
-- Migration: 20251016190000_add_station_working_hours.sql
-- =========================================
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



-- =========================================
-- Migration: 20251016191000_add_is_active_to_breeds.sql
-- =========================================
-- Migration to add is_active column to breeds table
-- This migration adds the is_active field to control whether customers can book appointments for a breed

BEGIN;

-- Add is_active to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_breeds_is_active ON public.breeds(is_active);

COMMENT ON COLUMN public.breeds.is_active IS 'האם הגזע פעיל - רק גזעים פעילים יכולים לקבוע תורים';

COMMIT;



-- =========================================
-- Migration: 20251016200000_add_station_breed_availability_fields.sql
-- =========================================
-- Migration to add is_active and remote_booking_allowed fields to station_breed_rules table
-- This allows managing breed-station specific active status and remote booking availability

BEGIN;

-- Add is_active to station_breed_rules table
ALTER TABLE public.station_breed_rules
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add remote_booking_allowed to station_breed_rules table
ALTER TABLE public.station_breed_rules
  ADD COLUMN IF NOT EXISTS remote_booking_allowed boolean NOT NULL DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_station_breed_rules_is_active ON public.station_breed_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_station_breed_rules_remote_booking ON public.station_breed_rules(remote_booking_allowed);

COMMENT ON COLUMN public.station_breed_rules.is_active IS 'האם הגזע פעיל עבור עמדה זו';
COMMENT ON COLUMN public.station_breed_rules.remote_booking_allowed IS 'האם ניתן לקבוע תור מרחוק עבור גזע זה בעמדה זו';

COMMIT;



-- =========================================
-- Migration: 20251016210000_add_station_breed_rules_policies.sql
-- =========================================
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



-- =========================================
-- Migration: 20251016210001_add_requires_staff_approval_to_station_breed_rules.sql
-- =========================================
-- Migration to add requires_staff_approval to station_breed_rules table
-- This allows managing breed-station specific staff approval requirements

BEGIN;

-- Add requires_staff_approval to station_breed_rules table
ALTER TABLE public.station_breed_rules
  ADD COLUMN IF NOT EXISTS requires_staff_approval boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_station_breed_rules_requires_staff_approval ON public.station_breed_rules(requires_staff_approval);

COMMENT ON COLUMN public.station_breed_rules.requires_staff_approval IS 'האם גזע זה דורש אישור צוות בעמדה זו';

COMMIT;



-- =========================================
-- Migration: 20251016210002_remove_requires_staff_approval_from_breeds.sql
-- =========================================
-- Migration to remove requires_staff_approval from breeds table
-- This field is now calculated dynamically from station_breed_rules
-- The actual values are stored at the station-breed level in station_breed_rules table

BEGIN;

-- Drop index if it exists
DROP INDEX IF EXISTS public.idx_breeds_requires_staff_approval;

-- Remove column from breeds table
ALTER TABLE public.breeds
  DROP COLUMN IF EXISTS requires_staff_approval;

COMMIT;



-- =========================================
-- Migration: 20251016220000_add_custom_absence_reasons.sql
-- =========================================
-- Create table for custom absence reasons
CREATE TABLE IF NOT EXISTS public.custom_absence_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_text text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_absence_reasons_reason_text 
  ON public.custom_absence_reasons(reason_text);

-- Trigger for updated_at
CREATE TRIGGER set_custom_absence_reasons_updated_at 
  BEFORE UPDATE ON public.custom_absence_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow managers to select custom reasons
CREATE POLICY custom_absence_reasons_select_manager 
  ON public.custom_absence_reasons
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Allow managers to insert custom reasons
CREATE POLICY custom_absence_reasons_insert_manager 
  ON public.custom_absence_reasons
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );



-- =========================================
-- Migration: 20251016230000_add_dog_categories.sql
-- =========================================
-- Create tables for dog types and categories
-- This migration adds support for main categories (dog types) and sub categories

BEGIN;

-- Create dog_types table (סוג כלב)
CREATE TABLE IF NOT EXISTS public.dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_types_name 
  ON public.dog_types(name);

-- Trigger for updated_at
CREATE TRIGGER set_dog_types_updated_at 
  BEFORE UPDATE ON public.dog_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create dog_categories table (קטגוריה)
CREATE TABLE IF NOT EXISTS public.dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_categories_name 
  ON public.dog_categories(name);

-- Trigger for updated_at
CREATE TRIGGER set_dog_categories_updated_at 
  BEFORE UPDATE ON public.dog_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create junction table for breeds and dog_types (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  dog_type_id uuid NOT NULL REFERENCES public.dog_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_type_id)
);

CREATE INDEX IF NOT EXISTS idx_breed_dog_types_breed_id 
  ON public.breed_dog_types(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_types_dog_type_id 
  ON public.breed_dog_types(dog_type_id);

-- Create junction table for breeds and dog_categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  dog_category_id uuid NOT NULL REFERENCES public.dog_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_category_id)
);

CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_breed_id 
  ON public.breed_dog_categories(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_dog_category_id 
  ON public.breed_dog_categories(dog_category_id);

-- RLS policies for dog_types
ALTER TABLE public.dog_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY dog_types_select_manager 
  ON public.dog_types
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_types_insert_manager 
  ON public.dog_types
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_types_update_manager 
  ON public.dog_types
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_types_delete_manager 
  ON public.dog_types
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- RLS policies for dog_categories
ALTER TABLE public.dog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY dog_categories_select_manager 
  ON public.dog_categories
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_categories_insert_manager 
  ON public.dog_categories
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_categories_update_manager 
  ON public.dog_categories
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY dog_categories_delete_manager 
  ON public.dog_categories
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- RLS policies for breed_dog_types
ALTER TABLE public.breed_dog_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY breed_dog_types_select_manager 
  ON public.breed_dog_types
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_types_insert_manager 
  ON public.breed_dog_types
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_types_delete_manager 
  ON public.breed_dog_types
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- RLS policies for breed_dog_categories
ALTER TABLE public.breed_dog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY breed_dog_categories_select_manager 
  ON public.breed_dog_categories
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_categories_insert_manager 
  ON public.breed_dog_categories
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY breed_dog_categories_delete_manager 
  ON public.breed_dog_categories
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

COMMIT;



-- =========================================
-- Migration: 20251101201830_remove_breed_level_active_remote_fields.sql
-- =========================================
-- Migration to remove is_active and remote_booking_allowed from breeds table
-- These fields are now calculated dynamically from station_breed_rules
-- The actual values are stored at the station-breed level in station_breed_rules table

BEGIN;

-- Drop indexes if they exist
DROP INDEX IF EXISTS public.idx_breeds_is_active;
DROP INDEX IF EXISTS public.idx_breeds_remote_booking;

-- Remove columns from breeds table
ALTER TABLE public.breeds
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE public.breeds
  DROP COLUMN IF EXISTS remote_booking_allowed;

COMMIT;



