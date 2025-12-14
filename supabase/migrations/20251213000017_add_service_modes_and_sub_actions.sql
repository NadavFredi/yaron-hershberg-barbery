-- Add service mode and duration support
-- Add mode column to services (simple or complicated)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS mode TEXT CHECK (mode IN ('simple', 'complicated'));

-- Set default mode for existing services
UPDATE public.services
SET mode = 'simple'
WHERE mode IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE public.services
  ALTER COLUMN mode SET DEFAULT 'simple',
  ALTER COLUMN mode SET NOT NULL;

-- Add duration column for simple mode services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Add is_active column (standardize naming, keep active for backward compatibility)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- Update is_active from existing active column if it exists, or set to true
UPDATE public.services
SET is_active = COALESCE(active, true)
WHERE is_active IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE public.services
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

-- Create service_sub_actions table for complicated mode services
CREATE TABLE IF NOT EXISTS public.service_sub_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_service_sub_actions_service_id ON public.service_sub_actions(service_id);
CREATE INDEX IF NOT EXISTS idx_service_sub_actions_order ON public.service_sub_actions(service_id, order_index);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_service_sub_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_service_sub_actions
  BEFORE UPDATE ON public.service_sub_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_service_sub_actions_updated_at();

-- Enable RLS
ALTER TABLE public.service_sub_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_sub_actions (same as services)
CREATE POLICY "Allow all operations on service_sub_actions"
  ON public.service_sub_actions
  FOR ALL
  USING (true);
