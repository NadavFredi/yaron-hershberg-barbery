-- Fix orders table to have grooming_appointment_id instead of appointment_id
-- Fix appointment_reminder_sent to have appointment_type column
-- Add foreign key constraints for tables that reference grooming_appointments

BEGIN;

-- Fix orders table
DO $$
BEGIN
  -- Only proceed if orders table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'orders'
  ) THEN
    -- Drop appointment_id column if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'appointment_id'
    ) THEN
      ALTER TABLE public.orders DROP COLUMN appointment_id;
    END IF;

    -- Add grooming_appointment_id if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'grooming_appointment_id'
    ) THEN
      ALTER TABLE public.orders ADD COLUMN grooming_appointment_id UUID;
    END IF;

    -- Removed daycare_appointment_id - no daycare in barbery system
  END IF;
END $$;

-- Add foreign key constraints for orders table
DO $$
BEGIN
  -- Add grooming_appointment_id foreign key if constraint doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_grooming_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_grooming_appointment_id_fkey 
      FOREIGN KEY (grooming_appointment_id) 
      REFERENCES public.grooming_appointments(id) 
      ON DELETE SET NULL;
  END IF;

  -- Removed daycare_appointment_id foreign key - no daycare in barbery system
END $$;

-- Fix appointment_reminder_sent table - add appointment_type column
DO $$
BEGIN
  -- Add appointment_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointment_reminder_sent' 
    AND column_name = 'appointment_type'
  ) THEN
    -- First add as nullable to handle existing rows
    ALTER TABLE public.appointment_reminder_sent 
      ADD COLUMN appointment_type TEXT;
    
    -- Set default value for existing rows
    UPDATE public.appointment_reminder_sent 
      SET appointment_type = 'grooming' 
      WHERE appointment_type IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE public.appointment_reminder_sent 
      ALTER COLUMN appointment_type SET NOT NULL;
    
    -- Set default for future rows
    ALTER TABLE public.appointment_reminder_sent 
      ALTER COLUMN appointment_type SET DEFAULT 'grooming';
    
    -- Add check constraint for appointment_type (drop first if exists)
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'appointment_reminder_sent_appointment_type_check'
    ) THEN
      ALTER TABLE public.appointment_reminder_sent
        DROP CONSTRAINT appointment_reminder_sent_appointment_type_check;
    END IF;
    
    ALTER TABLE public.appointment_reminder_sent
      ADD CONSTRAINT appointment_reminder_sent_appointment_type_check 
      CHECK (appointment_type = 'grooming'::text);
  END IF;
END $$;

-- Add foreign key constraints for tables that reference grooming_appointments
DO $$
BEGIN
  -- Add foreign key for cart_appointments.grooming_appointment_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cart_appointments_grooming_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.cart_appointments
      ADD CONSTRAINT cart_appointments_grooming_appointment_id_fkey 
      FOREIGN KEY (grooming_appointment_id) 
      REFERENCES public.grooming_appointments(id) 
      ON DELETE SET NULL;
  END IF;

  -- Add foreign key for orders.grooming_appointment_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_grooming_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_grooming_appointment_id_fkey 
      FOREIGN KEY (grooming_appointment_id) 
      REFERENCES public.grooming_appointments(id) 
      ON DELETE SET NULL;
  END IF;

  -- Add foreign key for appointment_payments.grooming_appointment_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointment_payments_grooming_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_payments
      ADD CONSTRAINT appointment_payments_grooming_appointment_id_fkey 
      FOREIGN KEY (grooming_appointment_id) 
      REFERENCES public.grooming_appointments(id) 
      ON DELETE SET NULL;
  END IF;

  -- Add foreign key for appointment_session_images.grooming_appointment_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointment_session_images_grooming_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_session_images
      ADD CONSTRAINT appointment_session_images_grooming_appointment_id_fkey 
      FOREIGN KEY (grooming_appointment_id) 
      REFERENCES public.grooming_appointments(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_grooming_appointment ON public.orders(grooming_appointment_id);
-- Removed daycare_appointment index - no daycare in barbery system
CREATE INDEX IF NOT EXISTS idx_appointment_reminder_sent_appointment ON public.appointment_reminder_sent(appointment_id, appointment_type);

COMMENT ON COLUMN public.orders.grooming_appointment_id IS 'Reference to grooming appointment for this order';
-- Removed daycare_appointment_id comment - no daycare in barbery system
COMMENT ON COLUMN public.appointment_reminder_sent.appointment_type IS 'Type of appointment: grooming only';

COMMIT;

