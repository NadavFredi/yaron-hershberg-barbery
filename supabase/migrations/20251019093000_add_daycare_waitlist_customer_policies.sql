-- Ensure authenticated customers can manage their own daycare_waitlist rows
DO $$
BEGIN
  -- Allow owners to view their waitlist entries
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY daycare_waitlist_select_self ON public.daycare_waitlist
        FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.customers c
            WHERE c.id = customer_id
              AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;

  -- Allow owners to insert waitlist entries for their dogs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_insert_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY daycare_waitlist_insert_self ON public.daycare_waitlist
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.customers c
            WHERE c.id = customer_id
              AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;

  -- Allow owners to update their entries
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_update_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY daycare_waitlist_update_self ON public.daycare_waitlist
        FOR UPDATE USING (
          EXISTS (
            SELECT 1
            FROM public.customers c
            WHERE c.id = customer_id
              AND c.auth_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.customers c
            WHERE c.id = customer_id
              AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;

  -- Allow owners to delete their entries if needed
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_waitlist'
      AND policyname = 'daycare_waitlist_delete_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY daycare_waitlist_delete_self ON public.daycare_waitlist
        FOR DELETE USING (
          EXISTS (
            SELECT 1
            FROM public.customers c
            WHERE c.id = customer_id
              AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;
