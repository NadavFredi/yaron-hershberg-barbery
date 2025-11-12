-- Remove obsolete station_treatment_types table in favor of service_station_matrix
DROP TABLE IF EXISTS public.station_treatment_types;

-- Consolidate appointments: grooming only
DROP TABLE IF EXISTS public.combined_appointments;
DROP TABLE IF EXISTS public.daycare_appointments;
DROP TABLE IF EXISTS public.grooming_appointments;
-- Remove unused daycare capacity limits
DROP TABLE IF EXISTS public.daycare_capacity_limits;

ALTER TABLE IF EXISTS public.appointment_payments DROP COLUMN IF EXISTS daycare_appointment_id;
ALTER TABLE IF EXISTS public.orders DROP COLUMN IF EXISTS daycare_appointment_id;
ALTER TABLE IF EXISTS public.ticket_usages DROP COLUMN IF EXISTS daycare_appointment_id;

-- Rename daycare_waitlist to waitlist
DO $$
BEGIN
  IF to_regclass('public.daycare_waitlist') IS NOT NULL THEN
    ALTER TABLE public.daycare_waitlist RENAME TO waitlist;
  END IF;
END;
$$;

-- Rename legacy trigger and indexes if they still exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_daycare_waitlist_updated_at'
      AND tgrelid = 'public.waitlist'::regclass
  ) THEN
    ALTER TRIGGER set_daycare_waitlist_updated_at ON public.waitlist RENAME TO set_waitlist_updated_at;
  END IF;
END;
$$;

ALTER INDEX IF EXISTS idx_daycare_waitlist_customer RENAME TO idx_waitlist_customer;
ALTER INDEX IF EXISTS idx_daycare_waitlist_treatment RENAME TO idx_waitlist_treatment;
ALTER INDEX IF EXISTS idx_daycare_waitlist_range RENAME TO idx_waitlist_range;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daycare_waitlist_pkey') THEN
    ALTER TABLE public.waitlist RENAME CONSTRAINT daycare_waitlist_pkey TO waitlist_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daycare_waitlist_airtable_id_key') THEN
    ALTER TABLE public.waitlist RENAME CONSTRAINT daycare_waitlist_airtable_id_key TO waitlist_airtable_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daycare_waitlist_customer_id_fkey') THEN
    ALTER TABLE public.waitlist RENAME CONSTRAINT daycare_waitlist_customer_id_fkey TO waitlist_customer_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daycare_waitlist_treatment_id_fkey') THEN
    ALTER TABLE public.waitlist RENAME CONSTRAINT daycare_waitlist_treatment_id_fkey TO waitlist_treatment_id_fkey;
  END IF;
END;
$$;

DROP TYPE IF EXISTS public.daycare_service_type;
