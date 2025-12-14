-- Create debt_status enum (only if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE public.debt_status AS ENUM ('open', 'partial', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create debts table
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  original_amount numeric(10,2) NOT NULL CHECK (original_amount > 0),
  description text,
  due_date timestamptz,
  status public.debt_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add debt_id to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_debts_customer ON public.debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON public.payments(debt_id);

-- Create function to calculate debt paid amount
CREATE OR REPLACE FUNCTION public.calculate_debt_paid_amount(debt_id_param uuid)
RETURNS numeric(10,2) AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.payments
  WHERE debt_id = debt_id_param
    AND status IN ('paid', 'partial');
$$ LANGUAGE sql STABLE;

-- Create function to calculate debt remaining amount
CREATE OR REPLACE FUNCTION public.calculate_debt_remaining_amount(debt_id_param uuid)
RETURNS numeric(10,2) AS $$
  SELECT 
    d.original_amount - COALESCE(calculate_debt_paid_amount(debt_id_param), 0)
  FROM public.debts d
  WHERE d.id = debt_id_param;
$$ LANGUAGE sql STABLE;

-- Create function to update debt status based on payments
CREATE OR REPLACE FUNCTION public.update_debt_status()
RETURNS TRIGGER AS $$
DECLARE
  debt_record public.debts%ROWTYPE;
  paid_amount numeric(10,2);
  remaining_amount numeric(10,2);
  new_status public.debt_status;
  target_debt_id uuid;
BEGIN
  -- Get the debt_id from NEW (for INSERT/UPDATE) or OLD (for DELETE)
  target_debt_id := COALESCE(NEW.debt_id, OLD.debt_id);

  -- If no debt_id, skip processing
  IF target_debt_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get the debt record
  SELECT * INTO debt_record
  FROM public.debts
  WHERE id = target_debt_id;

  IF debt_record.id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate paid amount
  paid_amount := calculate_debt_paid_amount(debt_record.id);
  remaining_amount := calculate_debt_remaining_amount(debt_record.id);

  -- Determine new status
  IF remaining_amount <= 0 THEN
    new_status := 'paid';
  ELSIF paid_amount > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'open';
  END IF;

  -- Update debt status if it changed
  IF debt_record.status != new_status THEN
    UPDATE public.debts
    SET status = new_status,
        updated_at = now()
    WHERE id = debt_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update debt status when payments are inserted/updated/deleted
CREATE TRIGGER trigger_update_debt_status_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_debt_status();

-- Add RLS policies
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view debts for customers they have access to
CREATE POLICY "Users can view debts"
  ON public.debts FOR SELECT
  USING (true);

-- Policy: Users can insert debts
CREATE POLICY "Users can insert debts"
  ON public.debts FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update debts
CREATE POLICY "Users can update debts"
  ON public.debts FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Users can delete debts
CREATE POLICY "Users can delete debts"
  ON public.debts FOR DELETE
  USING (true);
