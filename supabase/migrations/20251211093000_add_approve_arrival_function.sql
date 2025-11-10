BEGIN;

CREATE OR REPLACE FUNCTION public.approve_appointment_arrival(
  p_appointment_id uuid,
  p_new_status public.appointment_status DEFAULT 'approved',
  p_service_hint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_service text;
  v_is_manager boolean;
  v_customer_id uuid;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'manager'
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    SELECT c.id
    INTO v_customer_id
    FROM public.customers c
    WHERE c.auth_user_id = auth.uid();

    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'לקוח לא נמצא או משתמש אינו מורשה לאשר הגעה'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_service_hint IS NULL OR p_service_hint = 'grooming' THEN
    UPDATE public.grooming_appointments
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_appointment_id
      AND (v_is_manager OR customer_id = v_customer_id)
    RETURNING id, status INTO v_result;

    IF FOUND THEN
      v_service := 'grooming';
    END IF;
  END IF;

  IF v_result IS NULL AND (p_service_hint IS NULL OR p_service_hint IN ('garden', 'daycare')) THEN
    UPDATE public.daycare_appointments
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_appointment_id
      AND (v_is_manager OR customer_id = v_customer_id)
    RETURNING id, status INTO v_result;

    IF FOUND THEN
      v_service := 'garden';
    END IF;
  END IF;

  IF v_result IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = 'PGRST116',
            MESSAGE = 'Appointment not found or access denied';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_result.id,
    'service_type', v_service,
    'status', v_result.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_appointment_arrival(uuid, public.appointment_status, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_customer_appointment_arrival()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_manager boolean;
  v_customer_id uuid;
  v_row_customer_id uuid;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'manager'
  ) INTO v_is_manager;

  IF v_is_manager THEN
    RETURN NEW;
  END IF;

  v_row_customer_id := COALESCE(
    NEW.customer_id,
    OLD.customer_id,
    (
      SELECT d.customer_id
      FROM public.dogs d
      WHERE d.id = COALESCE(NEW.dog_id, OLD.dog_id)
      LIMIT 1
    )
  );

  SELECT c.id
  INTO v_customer_id
  FROM public.customers c
  WHERE c.auth_user_id = auth.uid();

  IF v_customer_id IS NULL OR v_customer_id <> v_row_customer_id THEN
    RAISE EXCEPTION 'גישה נדחתה לאישור הגעה'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status NOT IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'לקוחות יכולים לעדכן תור לאישור הגעה או ביטול בלבד'
      USING ERRCODE = 'P0001';
  END IF;

  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'לא ניתן לעדכן שדות נוספים בעת אישור הגעה'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_customer_arrival_grooming ON public.grooming_appointments;
CREATE TRIGGER enforce_customer_arrival_grooming
  BEFORE UPDATE ON public.grooming_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_appointment_arrival();

DROP TRIGGER IF EXISTS enforce_customer_arrival_daycare ON public.daycare_appointments;
CREATE TRIGGER enforce_customer_arrival_daycare
  BEFORE UPDATE ON public.daycare_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_appointment_arrival();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grooming_appointments'
      AND policyname = 'grooming_appointments_update_customer_arrival'
  ) THEN
    CREATE POLICY grooming_appointments_update_customer_arrival ON public.grooming_appointments
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.auth_user_id = auth.uid()
            AND c.id = COALESCE(
              customer_id,
              (SELECT d.customer_id FROM public.dogs d WHERE d.id = dog_id LIMIT 1)
            )
        )
      )
      WITH CHECK (
        status IN ('approved', 'cancelled') AND
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.auth_user_id = auth.uid()
            AND c.id = COALESCE(
              customer_id,
              (SELECT d.customer_id FROM public.dogs d WHERE d.id = dog_id LIMIT 1)
            )
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daycare_appointments'
      AND policyname = 'daycare_appointments_update_customer_arrival'
  ) THEN
    CREATE POLICY daycare_appointments_update_customer_arrival ON public.daycare_appointments
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.auth_user_id = auth.uid()
            AND c.id = COALESCE(
              customer_id,
              (SELECT d.customer_id FROM public.dogs d WHERE d.id = dog_id LIMIT 1)
            )
        )
      )
      WITH CHECK (
        status IN ('approved', 'cancelled') AND
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.auth_user_id = auth.uid()
            AND c.id = COALESCE(
              customer_id,
              (SELECT d.customer_id FROM public.dogs d WHERE d.id = dog_id LIMIT 1)
            )
        )
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_customer_appointment_arrival() TO authenticated;

COMMIT;

