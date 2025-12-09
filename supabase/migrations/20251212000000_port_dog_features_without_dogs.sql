-- Port core scheduling/commerce features from the dog barbery app into the human grooming app.
-- Drops dog/garden specific columns and introduces payments, carts, orders, pinned appointments,
-- appointment reminders, and supporting tables in a service-first model.

-- Safety: required extensions -------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums ----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type_kind') THEN
    CREATE TYPE public.ticket_type_kind AS ENUM ('entrances', 'days');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expiry_calculation_method') THEN
    CREATE TYPE public.expiry_calculation_method AS ENUM ('from_purchase_date', 'from_first_usage');
  END IF;
END;
$$;

-- Appointments cleanup + human-specific fields -------------------------------
ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS service_type,
  DROP COLUMN IF EXISTS late_pickup_requested,
  DROP COLUMN IF EXISTS late_pickup_notes,
  DROP COLUMN IF EXISTS garden_trim_nails,
  DROP COLUMN IF EXISTS garden_brush,
  DROP COLUMN IF EXISTS garden_bath,
  DROP COLUMN IF EXISTS questionnaire_result;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_name TEXT,
  ADD COLUMN IF NOT EXISTS client_confirmed_arrival BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grooming_notes TEXT;

-- Sequence for cart numbers --------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.cart_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Commerce tables ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  stock_quantity INTEGER,
  cost_price NUMERIC(10,2),
  bundle_price NUMERIC(10,2),
  retail_price NUMERIC(10,2),
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  cart_number INTEGER NOT NULL DEFAULT nextval('public.cart_number_seq'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT carts_cart_number_unique UNIQUE (cart_number)
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  item_name TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  grooming_appointment_id UUID,
  -- Removed daycare_appointment_id - no daycare in barbery system
  -- Foreign key to grooming_appointments will be added in a later migration
  appointment_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT cart_appointments_check CHECK (
    (grooming_appointment_id IS NOT NULL)
    -- Removed daycare_appointment_id check - no daycare in barbery system
  ),
  CONSTRAINT cart_appointments_unique UNIQUE (cart_id, grooming_appointment_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  grooming_appointment_id UUID,
  -- Removed daycare_appointment_id - no daycare in barbery system
  -- Foreign key to grooming_appointments will be added in a later migration
  status TEXT,
  subtotal NUMERIC(10,2),
  total NUMERIC(10,2),
  cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
  invoice_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2),
  item_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider TEXT,
  token TEXT,
  cvv TEXT,
  last4 TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ILS',
  status public.payment_status NOT NULL DEFAULT 'unpaid',
  method TEXT,
  token_id UUID REFERENCES public.credit_tokens(id) ON DELETE SET NULL,
  metadata JSONB,
  note TEXT,
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  grooming_appointment_id UUID,
  -- Removed daycare_appointment_id - no daycare in barbery system
  -- Foreign key to grooming_appointments will be added in a later migration
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT appointment_payments_check CHECK (
    (grooming_appointment_id IS NOT NULL)
    -- Removed daycare_appointment_id check - no daycare in barbery system
  )
);

-- Tickets / subscriptions ----------------------------------------------------
ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS type public.ticket_type_kind NOT NULL DEFAULT 'entrances',
  ADD COLUMN IF NOT EXISTS days_duration INTEGER,
  ADD COLUMN IF NOT EXISTS expiration_days INTEGER NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_calculation_method public.expiry_calculation_method NOT NULL DEFAULT 'from_purchase_date',
  ADD COLUMN IF NOT EXISTS visible_to_users BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  expires_on DATE,
  total_entries INTEGER,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  units_used NUMERIC(6,2) NOT NULL DEFAULT 1,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Appointment reminders & session assets ------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reminder_days INTEGER,
  reminder_hours INTEGER,
  flow_id TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT appointment_reminders_day_type_check CHECK (day_type IN ('regular', 'sunday')),
  CONSTRAINT appointment_reminders_timing_check CHECK ((reminder_days IS NOT NULL) OR (reminder_hours IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.appointment_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  regular_days_reminder_days INTEGER,
  regular_days_reminder_hours INTEGER,
  regular_days_flow_id TEXT,
  sunday_reminder_days INTEGER,
  sunday_reminder_hours INTEGER,
  sunday_flow_id TEXT,
  message_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_reminder_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'grooming' CHECK (appointment_type = 'grooming'::text),
  -- Removed 'daycare' and 'garden' from appointment_type - barbery system only has grooming appointments
  reminder_id UUID NOT NULL REFERENCES public.appointment_reminders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  flow_id TEXT NOT NULL,
  manychat_subscriber_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.appointment_session_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grooming_appointment_id UUID,
  -- Removed daycare_appointment_id - no daycare in barbery system
  -- Foreign key to grooming_appointments will be added in a later migration
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Scheduling helpers ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pinned_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id TEXT NOT NULL, -- TEXT to support both UUIDs (appointments) and "proposed-" prefixed IDs (proposed meetings)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  notes TEXT,
  target_date DATE,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  auto_remove_after TIMESTAMP WITH TIME ZONE,
  CONSTRAINT pinned_appointments_unique UNIQUE (user_id, appointment_id)
);

CREATE TABLE IF NOT EXISTS public.station_daily_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday TEXT NOT NULL,
  visible_station_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  station_order_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  show_waiting_list BOOLEAN NOT NULL DEFAULT false,
  show_pinned_appointments BOOLEAN NOT NULL DEFAULT false,
  special_items_order TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT station_daily_configs_weekday_check CHECK (weekday IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday'))
);

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL DEFAULT 'phone',
  contact_value TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_out TIMESTAMP WITH TIME ZONE,
  clock_in_note TEXT,
  clock_out_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT worker_attendance_time_check CHECK (clock_out IS NULL OR clock_out >= clock_in)
);

CREATE TABLE IF NOT EXISTS public.manager_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.edge_function_host_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON public.payments (appointment_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON public.carts (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pinned_appointments_user ON public.pinned_appointments (user_id, pinned_at DESC);
CREATE INDEX IF NOT EXISTS idx_pinned_appointments_appt ON public.pinned_appointments (appointment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_usages_ticket ON public.ticket_usages (ticket_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_usages_appointment ON public.ticket_usages (appointment_id);
CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker ON public.worker_attendance_logs (worker_id, clock_in DESC);

-- Triggers to maintain updated_at -------------------------------------------
DO $$
BEGIN
  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_products';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_carts';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_carts BEFORE UPDATE ON public.carts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_cart_items';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_cart_items BEFORE UPDATE ON public.cart_items
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_orders';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_order_items';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_order_items BEFORE UPDATE ON public.order_items
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_credit_tokens';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_credit_tokens BEFORE UPDATE ON public.credit_tokens
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_payments';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tickets';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_tickets BEFORE UPDATE ON public.tickets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ticket_usages';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_ticket_usages BEFORE UPDATE ON public.ticket_usages
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_appointment_reminders';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_appointment_reminders BEFORE UPDATE ON public.appointment_reminders
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_appointment_reminder_settings';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_appointment_reminder_settings BEFORE UPDATE ON public.appointment_reminder_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_appointment_session_images';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_appointment_session_images BEFORE UPDATE ON public.appointment_session_images
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_station_daily_configs';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_station_daily_configs BEFORE UPDATE ON public.station_daily_configs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_customer_contacts';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_customer_contacts BEFORE UPDATE ON public.customer_contacts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_worker_attendance_logs';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_worker_attendance_logs BEFORE UPDATE ON public.worker_attendance_logs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_edge_function_host_config';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_edge_function_host_config BEFORE UPDATE ON public.edge_function_host_config
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'set_updated_at_pinned_appointments';
  IF NOT FOUND THEN
    CREATE TRIGGER set_updated_at_pinned_appointments BEFORE UPDATE ON public.pinned_appointments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- RLS enablement -------------------------------------------------------------
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminder_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_session_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_daily_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_host_config ENABLE ROW LEVEL SECURITY;

-- Open policies for now (to be hardened later) -------------------------------
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'brands','products','carts','cart_items','cart_appointments','orders','order_items',
    'credit_tokens','payments','appointment_payments','tickets','ticket_usages',
    'appointment_reminders','appointment_reminder_settings','appointment_reminder_sent',
    'appointment_session_images','pinned_appointments','station_daily_configs',
    'customer_contacts','worker_attendance_logs','manager_roles','edge_function_host_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_allow_all'
    ) THEN
      EXECUTE format('CREATE POLICY "%s_allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END IF;
  END LOOP;
END;
$$;
