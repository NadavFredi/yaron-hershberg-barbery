-- Add customer types table and link customers to types
-- Allows managers to manage prioritized customer categories

BEGIN;

-- Ensure helper function for updated_at exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create customer_types table
CREATE TABLE IF NOT EXISTS public.customer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  priority integer NOT NULL DEFAULT 1 CHECK (priority >= 1),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_types_priority
  ON public.customer_types(priority);

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS set_customer_types_updated_at ON public.customer_types;
CREATE TRIGGER set_customer_types_updated_at
  BEFORE UPDATE ON public.customer_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link customers to types
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type_id uuid REFERENCES public.customer_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_customer_type_id
  ON public.customers(customer_type_id);

-- Enable RLS and add policies for managers
ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_types'
        AND policyname = 'customer_types_select_authenticated'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY customer_types_select_authenticated
        ON public.customer_types
        FOR SELECT TO authenticated
        USING (true)
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_types'
        AND policyname = 'customer_types_insert_manager'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY customer_types_insert_manager
        ON public.customer_types
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'manager'
          )
        )
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_types'
        AND policyname = 'customer_types_update_manager'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY customer_types_update_manager
        ON public.customer_types
        FOR UPDATE TO authenticated
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

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_types'
        AND policyname = 'customer_types_delete_manager'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY customer_types_delete_manager
        ON public.customer_types
        FOR DELETE TO authenticated
        USING (
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

COMMIT;


