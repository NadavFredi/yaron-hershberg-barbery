-- Create tables for dog types and categories
-- This migration adds support for main categories (dog types) and sub categories

BEGIN;

-- Create dog_types table (סוג כלב)
CREATE TABLE IF NOT EXISTS public.dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_types_name 
  ON public.dog_types(name);

-- Trigger for updated_at (only if doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_dog_types_updated_at'
  ) THEN
    CREATE TRIGGER set_dog_types_updated_at 
      BEFORE UPDATE ON public.dog_types
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Create dog_categories table (קטגוריה)
CREATE TABLE IF NOT EXISTS public.dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_categories_name 
  ON public.dog_categories(name);

-- Trigger for updated_at (only if doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_dog_categories_updated_at'
  ) THEN
    CREATE TRIGGER set_dog_categories_updated_at 
      BEFORE UPDATE ON public.dog_categories
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Create junction table for breeds and dog_types (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  dog_type_id uuid NOT NULL REFERENCES public.dog_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_type_id)
);

CREATE INDEX IF NOT EXISTS idx_breed_dog_types_breed_id 
  ON public.breed_dog_types(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_types_dog_type_id 
  ON public.breed_dog_types(dog_type_id);

-- Create junction table for breeds and dog_categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  dog_category_id uuid NOT NULL REFERENCES public.dog_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_category_id)
);

CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_breed_id 
  ON public.breed_dog_categories(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_dog_category_id 
  ON public.breed_dog_categories(dog_category_id);

-- RLS policies for dog_types
ALTER TABLE public.dog_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'Refreshing RLS policies for dog_types.';
  EXECUTE 'DROP POLICY IF EXISTS dog_types_select_manager ON public.dog_types';
  EXECUTE 'DROP POLICY IF EXISTS dog_types_insert_manager ON public.dog_types';
  EXECUTE 'DROP POLICY IF EXISTS dog_types_update_manager ON public.dog_types';
  EXECUTE 'DROP POLICY IF EXISTS dog_types_delete_manager ON public.dog_types';

  EXECUTE $policy$
    CREATE POLICY dog_types_select_manager 
      ON public.dog_types
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY dog_types_insert_manager 
      ON public.dog_types
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY dog_types_update_manager 
      ON public.dog_types
      FOR UPDATE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY dog_types_delete_manager 
      ON public.dog_types
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;
END;
$$;

-- RLS policies for dog_categories
ALTER TABLE public.dog_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'Refreshing RLS policies for dog_categories.';
  EXECUTE 'DROP POLICY IF EXISTS dog_categories_select_manager ON public.dog_categories';
  EXECUTE 'DROP POLICY IF EXISTS dog_categories_insert_manager ON public.dog_categories';
  EXECUTE 'DROP POLICY IF EXISTS dog_categories_update_manager ON public.dog_categories';
  EXECUTE 'DROP POLICY IF EXISTS dog_categories_delete_manager ON public.dog_categories';

  EXECUTE $policy$
    CREATE POLICY dog_categories_select_manager 
      ON public.dog_categories
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY dog_categories_insert_manager 
      ON public.dog_categories
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY dog_categories_update_manager 
      ON public.dog_categories
      FOR UPDATE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY dog_categories_delete_manager 
      ON public.dog_categories
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;
END;
$$;

-- RLS policies for breed_dog_types
ALTER TABLE public.breed_dog_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'Refreshing RLS policies for breed_dog_types.';
  EXECUTE 'DROP POLICY IF EXISTS breed_dog_types_select_manager ON public.breed_dog_types';
  EXECUTE 'DROP POLICY IF EXISTS breed_dog_types_insert_manager ON public.breed_dog_types';
  EXECUTE 'DROP POLICY IF EXISTS breed_dog_types_delete_manager ON public.breed_dog_types';

  EXECUTE $policy$
    CREATE POLICY breed_dog_types_select_manager 
      ON public.breed_dog_types
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY breed_dog_types_insert_manager 
      ON public.breed_dog_types
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY breed_dog_types_delete_manager 
      ON public.breed_dog_types
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;
END;
$$;

-- RLS policies for breed_dog_categories
ALTER TABLE public.breed_dog_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'Refreshing RLS policies for breed_dog_categories.';
  EXECUTE 'DROP POLICY IF EXISTS breed_dog_categories_select_manager ON public.breed_dog_categories';
  EXECUTE 'DROP POLICY IF EXISTS breed_dog_categories_insert_manager ON public.breed_dog_categories';
  EXECUTE 'DROP POLICY IF EXISTS breed_dog_categories_delete_manager ON public.breed_dog_categories';

  EXECUTE $policy$
    CREATE POLICY breed_dog_categories_select_manager 
      ON public.breed_dog_categories
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY breed_dog_categories_insert_manager 
      ON public.breed_dog_categories
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY breed_dog_categories_delete_manager 
      ON public.breed_dog_categories
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'manager'
        )
      )
  $policy$;
END;
$$;

COMMIT;

