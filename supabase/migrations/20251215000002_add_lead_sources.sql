-- Create lead_sources table
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add lead_source_id to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL;

-- Create index for lead_source_id
CREATE INDEX IF NOT EXISTS idx_customers_lead_source ON public.customers(lead_source_id);

-- Create updated_at trigger for lead_sources
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_lead_sources_updated_at
  BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create customer_gender enum
DO $$ BEGIN
    CREATE TYPE public.customer_gender AS ENUM ('male', 'female', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add additional fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS gender public.customer_gender,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Create index for external_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_external_id ON public.customers(external_id) WHERE external_id IS NOT NULL;

-- Create index for is_banned for filtering
CREATE INDEX IF NOT EXISTS idx_customers_is_banned ON public.customers(is_banned) WHERE is_banned = true;
