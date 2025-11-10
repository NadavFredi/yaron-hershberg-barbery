-- Proposed meetings schema to support manager-led invitation holds on the schedule
-- Includes meetings, invitees (customers), and customer-type targeting metadata

BEGIN;

-- Base proposed meetings table
CREATE TABLE IF NOT EXISTS public.proposed_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
  service_type text NOT NULL DEFAULT 'grooming' CHECK (service_type IN ('grooming', 'garden')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
  title text,
  summary text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposed_meetings_time_check CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_proposed_meetings_station_time
  ON public.proposed_meetings (station_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_proposed_meetings_status
  ON public.proposed_meetings (status);

DROP TRIGGER IF EXISTS set_proposed_meetings_updated_at ON public.proposed_meetings;
CREATE TRIGGER set_proposed_meetings_updated_at
  BEFORE UPDATE ON public.proposed_meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.proposed_meetings ENABLE ROW LEVEL SECURITY;

-- Invitees table (per customer tracking)
CREATE TABLE IF NOT EXISTS public.proposed_meeting_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_meeting_id uuid NOT NULL REFERENCES public.proposed_meetings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'category')),
  source_category_id uuid REFERENCES public.customer_types(id) ON DELETE SET NULL,
  last_notified_at timestamptz,
  notification_count integer NOT NULL DEFAULT 0,
  last_webhook_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposed_meeting_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_proposed_meeting_invites_meeting
  ON public.proposed_meeting_invites (proposed_meeting_id);

CREATE INDEX IF NOT EXISTS idx_proposed_meeting_invites_customer
  ON public.proposed_meeting_invites (customer_id);

DROP TRIGGER IF EXISTS set_proposed_meeting_invites_updated_at ON public.proposed_meeting_invites;
CREATE TRIGGER set_proposed_meeting_invites_updated_at
  BEFORE UPDATE ON public.proposed_meeting_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.proposed_meeting_invites ENABLE ROW LEVEL SECURITY;

-- Customer type targeting table
CREATE TABLE IF NOT EXISTS public.proposed_meeting_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_meeting_id uuid NOT NULL REFERENCES public.proposed_meetings(id) ON DELETE CASCADE,
  customer_type_id uuid NOT NULL REFERENCES public.customer_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposed_meeting_categories_unique
  ON public.proposed_meeting_categories (proposed_meeting_id, customer_type_id);

CREATE INDEX IF NOT EXISTS idx_proposed_meeting_categories_meeting
  ON public.proposed_meeting_categories (proposed_meeting_id);

ALTER TABLE public.proposed_meeting_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies (read for all authenticated, write for managers)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    -- Proposed meetings policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'proposed_meetings'
        AND policyname = 'proposed_meetings_select_authenticated'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY proposed_meetings_select_authenticated
        ON public.proposed_meetings
        FOR SELECT TO authenticated
        USING (true)
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'proposed_meetings'
        AND policyname = 'proposed_meetings_modify_manager'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY proposed_meetings_modify_manager
        ON public.proposed_meetings
        FOR ALL TO authenticated
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
        )
      $policy$;
    END IF;

    -- Invite policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'proposed_meeting_invites'
        AND policyname = 'proposed_meeting_invites_select_authenticated'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY proposed_meeting_invites_select_authenticated
        ON public.proposed_meeting_invites
        FOR SELECT TO authenticated
        USING (true)
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'proposed_meeting_invites'
        AND policyname = 'proposed_meeting_invites_modify_manager'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY proposed_meeting_invites_modify_manager
        ON public.proposed_meeting_invites
        FOR ALL TO authenticated
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
        )
      $policy$;
    END IF;

    -- Category policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'proposed_meeting_categories'
        AND policyname = 'proposed_meeting_categories_select_authenticated'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY proposed_meeting_categories_select_authenticated
        ON public.proposed_meeting_categories
        FOR SELECT TO authenticated
        USING (true)
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'proposed_meeting_categories'
        AND policyname = 'proposed_meeting_categories_modify_manager'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY proposed_meeting_categories_modify_manager
        ON public.proposed_meeting_categories
        FOR ALL TO authenticated
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
        )
      $policy$;
    END IF;
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposed_meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposed_meeting_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposed_meeting_categories TO authenticated;

COMMIT;
