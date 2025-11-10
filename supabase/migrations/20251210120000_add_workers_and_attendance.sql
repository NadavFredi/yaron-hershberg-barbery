-- Extend the user_role enum with a worker role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'worker'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'worker';
  END IF;
END;
$$;

-- Add worker activity tracking fields and attendance logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'worker_is_active'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN worker_is_active boolean DEFAULT true;

    UPDATE public.profiles
    SET worker_is_active = true
    WHERE worker_is_active IS NULL;

    ALTER TABLE public.profiles
      ALTER COLUMN worker_is_active SET NOT NULL;
  END IF;
END;
$$;

-- Attendance log table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'worker_attendance_logs'
  ) THEN
    CREATE TABLE public.worker_attendance_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      clock_in timestamptz NOT NULL DEFAULT now(),
      clock_out timestamptz,
      clock_in_note text,
      clock_out_note text,
      created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT worker_attendance_time_check CHECK (clock_out IS NULL OR clock_out >= clock_in)
    );

    CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker_clock_in
      ON public.worker_attendance_logs (worker_id, clock_in DESC);

    CREATE INDEX IF NOT EXISTS idx_worker_attendance_open_shifts
      ON public.worker_attendance_logs (worker_id)
      WHERE clock_out IS NULL;

    CREATE TRIGGER set_worker_attendance_updated_at
      BEFORE UPDATE ON public.worker_attendance_logs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.worker_attendance_logs ENABLE ROW LEVEL SECURITY;

-- Worker self-service policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'worker_attendance_logs'
      AND policyname = 'worker_attendance_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY worker_attendance_select_self
      ON public.worker_attendance_logs
      FOR SELECT TO authenticated
      USING (auth.uid() = worker_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'worker_attendance_logs'
      AND policyname = 'worker_attendance_modify_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY worker_attendance_modify_self
      ON public.worker_attendance_logs
      FOR UPDATE TO authenticated
      USING (auth.uid() = worker_id)
      WITH CHECK (auth.uid() = worker_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'worker_attendance_logs'
      AND policyname = 'worker_attendance_insert_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY worker_attendance_insert_self
      ON public.worker_attendance_logs
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = worker_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'worker_attendance_logs'
      AND policyname = 'worker_attendance_manager_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY worker_attendance_manager_all
      ON public.worker_attendance_logs
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
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.worker_attendance_logs TO authenticated;

