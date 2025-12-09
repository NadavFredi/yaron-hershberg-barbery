-- Make contact_value and contact_type nullable in customer_contacts table
-- This allows inserts using name and phone columns without requiring the old contact fields

ALTER TABLE public.customer_contacts
  ALTER COLUMN contact_value DROP NOT NULL,
  ALTER COLUMN contact_type DROP NOT NULL;
