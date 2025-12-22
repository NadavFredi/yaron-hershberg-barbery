-- Add calendar window hours to calendar_settings table
-- These fields control which hours are visible on the manager calendar view
-- They do NOT affect customer-facing functionality

DO $$
BEGIN
  -- Add calendar_start_time column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_settings'
      AND column_name = 'calendar_start_time'
  ) THEN
    RAISE NOTICE 'Adding calendar_start_time column to calendar_settings.';
    ALTER TABLE public.calendar_settings
      ADD COLUMN calendar_start_time TIME;
  ELSE
    RAISE NOTICE 'calendar_start_time column already exists.';
  END IF;

  -- Add calendar_end_time column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_settings'
      AND column_name = 'calendar_end_time'
  ) THEN
    RAISE NOTICE 'Adding calendar_end_time column to calendar_settings.';
    ALTER TABLE public.calendar_settings
      ADD COLUMN calendar_end_time TIME;
  ELSE
    RAISE NOTICE 'calendar_end_time column already exists.';
  END IF;
END;
$$;

-- Set default values for existing rows if they are NULL
-- Default to 08:00 - 20:00 if not set
UPDATE public.calendar_settings
SET 
  calendar_start_time = COALESCE(calendar_start_time, '08:00:00'::TIME),
  calendar_end_time = COALESCE(calendar_end_time, '20:00:00'::TIME)
WHERE calendar_start_time IS NULL OR calendar_end_time IS NULL;

