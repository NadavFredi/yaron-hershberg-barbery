-- Create FAQs table
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL, -- Rich text HTML content
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for display_order for efficient sorting
CREATE INDEX IF NOT EXISTS idx_faqs_display_order ON public.faqs(display_order);

-- Create index for is_visible for filtering visible FAQs
CREATE INDEX IF NOT EXISTS idx_faqs_is_visible ON public.faqs(is_visible) WHERE is_visible = true;

-- Create updated_at trigger for faqs
CREATE TRIGGER set_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read visible FAQs
CREATE POLICY "Anyone can view visible FAQs"
  ON public.faqs
  FOR SELECT
  USING (is_visible = true);

-- Policy: Only managers can view all FAQs (including hidden ones)
CREATE POLICY "Managers can view all FAQs"
  ON public.faqs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- Policy: Only managers can insert FAQs
CREATE POLICY "Managers can insert FAQs"
  ON public.faqs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- Policy: Only managers can update FAQs
CREATE POLICY "Managers can update FAQs"
  ON public.faqs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- Policy: Only managers can delete FAQs
CREATE POLICY "Managers can delete FAQs"
  ON public.faqs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

