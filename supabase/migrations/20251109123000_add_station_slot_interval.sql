-- Add slot interval column to stations
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER NOT NULL DEFAULT 60;

-- Ensure existing rows populate the new column (for older rows where default might not backfill)
UPDATE public.stations
SET slot_interval_minutes = 60
WHERE slot_interval_minutes IS NULL;


