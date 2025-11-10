-- Grant customers the ability to manage their own records after moving off Airtable

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_delete_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY dogs_delete_self ON public.dogs
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daycare_appointments' AND policyname = 'daycare_appointments_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY daycare_appointments_select_self ON public.daycare_appointments
        FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.dogs d
            JOIN public.customers c ON c.id = d.customer_id
            WHERE d.id = dog_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grooming_appointments' AND policyname = 'grooming_appointments_select_self'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY grooming_appointments_select_self ON public.grooming_appointments
        FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.dogs d
            JOIN public.customers c ON c.id = d.customer_id
            WHERE d.id = dog_id AND c.auth_user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END;
$$;

COMMIT;
