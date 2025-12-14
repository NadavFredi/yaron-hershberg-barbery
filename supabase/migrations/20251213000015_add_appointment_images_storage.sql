BEGIN;

-- Create single storage bucket for all images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for images bucket
-- Folder structure: appointment-session/
DO $$
BEGIN
  -- Allow managers to upload images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can upload images'
  ) THEN
    CREATE POLICY "Managers can upload images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'images' AND
      name LIKE 'appointment-session/%' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'manager'
      )
    );
  END IF;

  -- Allow managers to update images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can update images'
  ) THEN
    CREATE POLICY "Managers can update images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'images' AND
      name LIKE 'appointment-session/%' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'manager'
      )
    )
    WITH CHECK (
      bucket_id = 'images' AND
      name LIKE 'appointment-session/%' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'manager'
      )
    );
  END IF;

  -- Allow managers to delete images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can delete images'
  ) THEN
    CREATE POLICY "Managers can delete images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'images' AND
      name LIKE 'appointment-session/%' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'manager'
      )
    );
  END IF;

  -- Allow public read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can read images'
  ) THEN
    CREATE POLICY "Public can read images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'images');
  END IF;
END;
$$;

COMMIT;
