-- Add staff_notes column to customers table if it doesn't exist
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS staff_notes text;
