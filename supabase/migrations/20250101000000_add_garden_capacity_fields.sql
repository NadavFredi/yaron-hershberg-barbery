-- Ensure the daycare_capacity_limits table exists before altering it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'daycare_capacity_limits'
  ) THEN
    RAISE NOTICE 'Creating daycare_capacity_limits table prior to capacity field migration.';
    CREATE TABLE public.daycare_capacity_limits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      effective_date date NOT NULL,
      trial_limit integer NOT NULL DEFAULT 0,
      regular_limit integer NOT NULL DEFAULT 0,
      total_limit integer NOT NULL DEFAULT 0,
      hourly_limit integer NOT NULL DEFAULT 0,
      full_day_limit integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (effective_date)
    );
  ELSE
    RAISE NOTICE 'daycare_capacity_limits table already exists.';
  END IF;
END;
$$;

-- Add or backfill capacity fields on daycare_capacity_limits
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'daycare_capacity_limits'
  ) THEN
    RAISE NOTICE 'Ensuring capacity columns exist on daycare_capacity_limits.';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ADD COLUMN IF NOT EXISTS total_limit integer DEFAULT 0';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ADD COLUMN IF NOT EXISTS hourly_limit integer DEFAULT 0';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ADD COLUMN IF NOT EXISTS full_day_limit integer DEFAULT 0';

   RAISE NOTICE 'Backfilling capacity columns with default values.';
    EXECUTE '
      UPDATE public.daycare_capacity_limits
      SET total_limit = COALESCE(total_limit, COALESCE(regular_limit, 0)),
          hourly_limit = COALESCE(hourly_limit, 0),
          full_day_limit = COALESCE(full_day_limit, COALESCE(regular_limit, 0))
      WHERE total_limit IS NULL
         OR hourly_limit IS NULL
         OR full_day_limit IS NULL
    ';

    RAISE NOTICE 'Enforcing NOT NULL and default constraints for capacity columns.';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ALTER COLUMN total_limit SET NOT NULL';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ALTER COLUMN hourly_limit SET NOT NULL';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ALTER COLUMN full_day_limit SET NOT NULL';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ALTER COLUMN total_limit SET DEFAULT 0';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ALTER COLUMN hourly_limit SET DEFAULT 0';
    EXECUTE 'ALTER TABLE public.daycare_capacity_limits ALTER COLUMN full_day_limit SET DEFAULT 0';
  ELSE
    RAISE NOTICE 'daycare_capacity_limits table not found; skipping capacity field migration.';
  END IF;
END;
$$;
