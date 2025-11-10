-- Create tables for dog types and categories
-- This migration adds support for main categories (dog types) and sub categories

BEGIN;

-- Create set_updated_at function if it doesn't exist (required for triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create dog_types table (סוג כלב)
CREATE TABLE IF NOT EXISTS public.dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_types_name 
  ON public.dog_types(name);

-- Trigger for updated_at
CREATE TRIGGER set_dog_types_updated_at 
  BEFORE UPDATE ON public.dog_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create dog_categories table (קטגוריה)
CREATE TABLE IF NOT EXISTS public.dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_categories_name 
  ON public.dog_categories(name);

-- Trigger for updated_at
CREATE TRIGGER set_dog_categories_updated_at 
  BEFORE UPDATE ON public.dog_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create junction table for breeds and dog_types (many-to-many)
-- Note: breeds table must exist (created in initial_schema migration)
CREATE TABLE IF NOT EXISTS public.breed_dog_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL,
  dog_type_id uuid NOT NULL REFERENCES public.dog_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_type_id)
);

-- Add foreign key constraint only if breeds table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'breeds') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'breed_dog_types_breed_id_fkey'
    ) THEN
      ALTER TABLE public.breed_dog_types 
        ADD CONSTRAINT breed_dog_types_breed_id_fkey 
        FOREIGN KEY (breed_id) REFERENCES public.breeds(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_breed_dog_types_breed_id 
  ON public.breed_dog_types(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_types_dog_type_id 
  ON public.breed_dog_types(dog_type_id);

-- Create junction table for breeds and dog_categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.breed_dog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid NOT NULL,
  dog_category_id uuid NOT NULL REFERENCES public.dog_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(breed_id, dog_category_id)
);

-- Add foreign key constraint only if breeds table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'breeds') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'breed_dog_categories_breed_id_fkey'
    ) THEN
      ALTER TABLE public.breed_dog_categories 
        ADD CONSTRAINT breed_dog_categories_breed_id_fkey 
        FOREIGN KEY (breed_id) REFERENCES public.breeds(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_breed_id 
  ON public.breed_dog_categories(breed_id);
CREATE INDEX IF NOT EXISTS idx_breed_dog_categories_dog_category_id 
  ON public.breed_dog_categories(dog_category_id);

-- RLS policies for dog_types
ALTER TABLE public.dog_types ENABLE ROW LEVEL SECURITY;

-- Create policies only if profiles table with role column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'dog_types' AND policyname = 'dog_types_select_manager'
    ) THEN
      EXECUTE 'CREATE POLICY dog_types_select_manager ON public.dog_types FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_types' AND policyname = 'dog_types_insert_manager') THEN
      EXECUTE 'CREATE POLICY dog_types_insert_manager ON public.dog_types FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_types' AND policyname = 'dog_types_update_manager') THEN
      EXECUTE 'CREATE POLICY dog_types_update_manager ON public.dog_types FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_types' AND policyname = 'dog_types_delete_manager') THEN
      EXECUTE 'CREATE POLICY dog_types_delete_manager ON public.dog_types FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
  END IF;
END $$;

-- RLS policies for dog_categories
ALTER TABLE public.dog_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_categories' AND policyname = 'dog_categories_select_manager') THEN
      EXECUTE 'CREATE POLICY dog_categories_select_manager ON public.dog_categories FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_categories' AND policyname = 'dog_categories_insert_manager') THEN
      EXECUTE 'CREATE POLICY dog_categories_insert_manager ON public.dog_categories FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_categories' AND policyname = 'dog_categories_update_manager') THEN
      EXECUTE 'CREATE POLICY dog_categories_update_manager ON public.dog_categories FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dog_categories' AND policyname = 'dog_categories_delete_manager') THEN
      EXECUTE 'CREATE POLICY dog_categories_delete_manager ON public.dog_categories FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
  END IF;
END $$;

-- RLS policies for breed_dog_types
ALTER TABLE public.breed_dog_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breed_dog_types' AND policyname = 'breed_dog_types_select_manager') THEN
      EXECUTE 'CREATE POLICY breed_dog_types_select_manager ON public.breed_dog_types FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breed_dog_types' AND policyname = 'breed_dog_types_insert_manager') THEN
      EXECUTE 'CREATE POLICY breed_dog_types_insert_manager ON public.breed_dog_types FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breed_dog_types' AND policyname = 'breed_dog_types_delete_manager') THEN
      EXECUTE 'CREATE POLICY breed_dog_types_delete_manager ON public.breed_dog_types FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
  END IF;
END $$;

-- RLS policies for breed_dog_categories
ALTER TABLE public.breed_dog_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breed_dog_categories' AND policyname = 'breed_dog_categories_select_manager') THEN
      EXECUTE 'CREATE POLICY breed_dog_categories_select_manager ON public.breed_dog_categories FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breed_dog_categories' AND policyname = 'breed_dog_categories_insert_manager') THEN
      EXECUTE 'CREATE POLICY breed_dog_categories_insert_manager ON public.breed_dog_categories FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breed_dog_categories' AND policyname = 'breed_dog_categories_delete_manager') THEN
      EXECUTE 'CREATE POLICY breed_dog_categories_delete_manager ON public.breed_dog_categories FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''manager''))';
    END IF;
  END IF;
END $$;

COMMIT;

