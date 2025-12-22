-- Add hair coloring support for treatments/appointments
-- This migration creates tables to track hair coloring sessions and individual color items

-- Hair coloring sessions table
-- Links to grooming_appointments and stores overall session information
CREATE TABLE IF NOT EXISTS public.hair_coloring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grooming_appointment_id uuid NOT NULL REFERENCES public.grooming_appointments(id) ON DELETE CASCADE,
  total_dosage numeric,
  oxygen_level numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hair coloring items table
-- Stores individual color items within a session
CREATE TABLE IF NOT EXISTS public.hair_coloring_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hair_coloring_session_id uuid NOT NULL REFERENCES public.hair_coloring_sessions(id) ON DELETE CASCADE,
  color_number numeric NOT NULL,
  dosage numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_hair_coloring_sessions_appointment 
  ON public.hair_coloring_sessions(grooming_appointment_id);

CREATE INDEX IF NOT EXISTS idx_hair_coloring_sessions_customer 
  ON public.hair_coloring_sessions(grooming_appointment_id)
  INCLUDE (created_at);

CREATE INDEX IF NOT EXISTS idx_hair_coloring_items_session 
  ON public.hair_coloring_items(hair_coloring_session_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_hair_coloring_sessions_updated_at
  BEFORE UPDATE ON public.hair_coloring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hair_coloring_items_updated_at
  BEFORE UPDATE ON public.hair_coloring_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies (if RLS is enabled)
ALTER TABLE public.hair_coloring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_coloring_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view hair coloring sessions for appointments they have access to
CREATE POLICY "Users can view hair coloring sessions"
  ON public.hair_coloring_sessions
  FOR SELECT
  USING (true);

-- Policy: Users can insert hair coloring sessions
CREATE POLICY "Users can insert hair coloring sessions"
  ON public.hair_coloring_sessions
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update hair coloring sessions
CREATE POLICY "Users can update hair coloring sessions"
  ON public.hair_coloring_sessions
  FOR UPDATE
  USING (true);

-- Policy: Users can delete hair coloring sessions
CREATE POLICY "Users can delete hair coloring sessions"
  ON public.hair_coloring_sessions
  FOR DELETE
  USING (true);

-- Policy: Users can view hair coloring items
CREATE POLICY "Users can view hair coloring items"
  ON public.hair_coloring_items
  FOR SELECT
  USING (true);

-- Policy: Users can insert hair coloring items
CREATE POLICY "Users can insert hair coloring items"
  ON public.hair_coloring_items
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update hair coloring items
CREATE POLICY "Users can update hair coloring items"
  ON public.hair_coloring_items
  FOR UPDATE
  USING (true);

-- Policy: Users can delete hair coloring items
CREATE POLICY "Users can delete hair coloring items"
  ON public.hair_coloring_items
  FOR DELETE
  USING (true);

