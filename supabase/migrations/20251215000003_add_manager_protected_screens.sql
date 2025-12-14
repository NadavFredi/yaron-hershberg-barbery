-- Create table to store manager protected screen password (hashed)
CREATE TABLE IF NOT EXISTS public.manager_protected_screen_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id)
);

-- Create table to store which screens are protected for each manager
CREATE TABLE IF NOT EXISTS public.manager_protected_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screen_id text NOT NULL,
  is_protected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id, screen_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_manager_protected_screen_passwords_manager_id ON public.manager_protected_screen_passwords(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_protected_screens_manager_id ON public.manager_protected_screens(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_protected_screens_screen_id ON public.manager_protected_screens(screen_id);

-- Create updated_at trigger for manager_protected_screen_passwords
CREATE TRIGGER set_manager_protected_screen_passwords_updated_at
  BEFORE UPDATE ON public.manager_protected_screen_passwords
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create updated_at trigger for manager_protected_screens
CREATE TRIGGER set_manager_protected_screens_updated_at
  BEFORE UPDATE ON public.manager_protected_screens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.manager_protected_screen_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_protected_screens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Managers can only access their own protected screen settings
CREATE POLICY "Managers can view their own protected screen password"
  ON public.manager_protected_screen_passwords
  FOR SELECT
  USING (auth.uid() = manager_id);

CREATE POLICY "Managers can update their own protected screen password"
  ON public.manager_protected_screen_passwords
  FOR ALL
  USING (auth.uid() = manager_id);

CREATE POLICY "Managers can view their own protected screens"
  ON public.manager_protected_screens
  FOR SELECT
  USING (auth.uid() = manager_id);

CREATE POLICY "Managers can manage their own protected screens"
  ON public.manager_protected_screens
  FOR ALL
  USING (auth.uid() = manager_id);
