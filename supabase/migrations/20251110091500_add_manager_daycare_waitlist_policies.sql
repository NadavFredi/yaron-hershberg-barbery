-- Allow managers to manage daycare_waitlist entries for all customers
DO $$
BEGIN
  -- Allow managers to select all waitlist entries
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_select_manager'
  ) THEN
    CREATE POLICY daycare_waitlist_select_manager ON public.daycare_waitlist
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to insert waitlist entries
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_insert_manager'
  ) THEN
    CREATE POLICY daycare_waitlist_insert_manager ON public.daycare_waitlist
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to update waitlist entries
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_update_manager'
  ) THEN
    CREATE POLICY daycare_waitlist_update_manager ON public.daycare_waitlist
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;

  -- Allow managers to delete waitlist entries
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_delete_manager'
  ) THEN
    CREATE POLICY daycare_waitlist_delete_manager ON public.daycare_waitlist
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'manager'
        )
      );
  END IF;
END;
$$;

