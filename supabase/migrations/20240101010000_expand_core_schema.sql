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
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  breed_id uuid REFERENCES public.breeds(id) ON DELETE CASCADE,
  duration_modifier_minutes integer DEFAULT 0,
  price_modifier numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, service_id, breed_id)
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
