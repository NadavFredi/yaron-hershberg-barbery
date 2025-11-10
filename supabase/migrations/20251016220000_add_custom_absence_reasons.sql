-- Create table for custom absence reasons
CREATE TABLE IF NOT EXISTS public.custom_absence_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_text text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_absence_reasons_reason_text 
  ON public.custom_absence_reasons(reason_text);

-- Trigger for updated_at
CREATE TRIGGER set_custom_absence_reasons_updated_at 
  BEFORE UPDATE ON public.custom_absence_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow managers to select custom reasons
CREATE POLICY custom_absence_reasons_select_manager 
  ON public.custom_absence_reasons
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Allow managers to insert custom reasons
CREATE POLICY custom_absence_reasons_insert_manager 
  ON public.custom_absence_reasons
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

