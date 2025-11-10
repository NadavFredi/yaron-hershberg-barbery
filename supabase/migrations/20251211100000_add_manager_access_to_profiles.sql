-- Allow managers to view and manage worker profiles
BEGIN;

CREATE TABLE IF NOT EXISTS public.manager_roles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE
);

INSERT INTO public.manager_roles (user_id)
SELECT id
FROM public.profiles
WHERE role = 'manager'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_manager_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.manager_roles WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.role = 'manager' THEN
    INSERT INTO public.manager_roles(user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.manager_roles WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_manager_roles_trigger ON public.profiles;
CREATE TRIGGER sync_manager_roles_trigger
  AFTER INSERT OR UPDATE OF role OR DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_manager_roles();

DROP POLICY IF EXISTS profiles_select_manager ON public.profiles;
CREATE POLICY profiles_select_manager
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.manager_roles mr
      WHERE mr.user_id = auth.uid()
    )
    OR auth.uid() = id
  );

DROP POLICY IF EXISTS profiles_update_manager ON public.profiles;
CREATE POLICY profiles_update_manager
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.manager_roles mr
      WHERE mr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manager_roles mr
      WHERE mr.user_id = auth.uid()
    )
  );

COMMIT;

