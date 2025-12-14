-- Add is_default column to service_categories
ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Create unique constraint to ensure only one default category exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_single_default 
  ON public.service_categories(is_default) 
  WHERE is_default = true;
