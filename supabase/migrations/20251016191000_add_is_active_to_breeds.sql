-- Migration to add is_active column to breeds table
-- This migration adds the is_active field to control whether customers can book appointments for a breed

BEGIN;

-- Add is_active to breeds table
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_breeds_is_active ON public.breeds(is_active);

COMMENT ON COLUMN public.breeds.is_active IS 'האם הגזע פעיל - רק גזעים פעילים יכולים לקבוע תורים';

COMMIT;

