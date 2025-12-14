-- Add unique constraint on weekday for station_daily_configs
-- This allows upsert operations to work with onConflict: "weekday"

-- First, remove any duplicate entries (keep the most recent one per weekday)
DELETE FROM public.station_daily_configs
WHERE id NOT IN (
    SELECT DISTINCT ON (weekday) id
    FROM public.station_daily_configs
    ORDER BY weekday, updated_at DESC
);

-- Add unique constraint on weekday
ALTER TABLE public.station_daily_configs
ADD CONSTRAINT station_daily_configs_weekday_unique UNIQUE (weekday);

