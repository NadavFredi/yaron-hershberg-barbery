-- Add name and phone columns to customer_contacts table
-- These columns are required for the API to work correctly
-- Based on schema from backup_20251208_000227/schema.sql

-- First, add columns as nullable to allow migration of existing data
ALTER TABLE public.customer_contacts
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Migrate existing data from contact_value to phone if contact_type is 'phone'
UPDATE public.customer_contacts
SET 
  phone = CASE 
    WHEN contact_type = 'phone' AND contact_value IS NOT NULL THEN contact_value 
    ELSE phone 
  END
WHERE phone IS NULL AND contact_type = 'phone' AND contact_value IS NOT NULL;

-- Set default values for any remaining NULL values
UPDATE public.customer_contacts
SET 
  name = COALESCE(name, ''),
  phone = COALESCE(phone, '')
WHERE name IS NULL OR phone IS NULL;

-- Now make columns NOT NULL
ALTER TABLE public.customer_contacts
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN name SET DEFAULT '',
  ALTER COLUMN phone SET DEFAULT '';

-- Create index on customer_id for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id 
  ON public.customer_contacts(customer_id);
