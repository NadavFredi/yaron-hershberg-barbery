-- Add display_order column to control station ordering
ALTER TABLE public.stations
ADD COLUMN IF NOT EXISTS display_order integer;

-- Backfill existing rows based on creation order if the column was newly added
UPDATE public.stations AS s
SET display_order = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.stations
) AS sub
WHERE s.id = sub.id
  AND (s.display_order IS NULL OR s.display_order = 0);

-- Ensure the column is required going forward
ALTER TABLE public.stations
ALTER COLUMN display_order SET DEFAULT 0,
ALTER COLUMN display_order SET NOT NULL;

-- Create a helper function + trigger to auto-assign display_order on insert when not provided
CREATE OR REPLACE FUNCTION public.set_station_display_order()
RETURNS trigger AS $$
DECLARE
  next_order integer;
BEGIN
  IF NEW.display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), -1) + 1 INTO next_order FROM public.stations;
    NEW.display_order := next_order;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_station_display_order ON public.stations;

CREATE TRIGGER set_station_display_order
BEFORE INSERT ON public.stations
FOR EACH ROW
EXECUTE FUNCTION public.set_station_display_order();
