-- Add RLS policies to allow authenticated users (managers) to manage dogs
-- NOTE: This is a temporary migration that will be replaced by 20251016150000_update_manager_policies_with_role.sql
-- once the role column is added to profiles. It allows all authenticated users for now.
-- This enables managers to create/update/delete dogs for any customer

BEGIN;

-- Dogs policies for managers (temporary - will be replaced with role-based checks)
DO $$
BEGIN
  -- Allow authenticated users to select all dogs (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_select_authenticated'
  ) THEN
    CREATE POLICY dogs_select_authenticated ON public.dogs
      FOR SELECT 
      TO authenticated
      USING (true);
  END IF;

  -- Allow authenticated users to insert dogs for any customer (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_insert_authenticated'
  ) THEN
    CREATE POLICY dogs_insert_authenticated ON public.dogs
      FOR INSERT 
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to update dogs for any customer (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_update_authenticated'
  ) THEN
    CREATE POLICY dogs_update_authenticated ON public.dogs
      FOR UPDATE 
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Allow authenticated users to delete dogs for any customer (for manager operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dogs' AND policyname = 'dogs_delete_authenticated'
  ) THEN
    CREATE POLICY dogs_delete_authenticated ON public.dogs
      FOR DELETE 
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dogs TO authenticated;

COMMIT;

