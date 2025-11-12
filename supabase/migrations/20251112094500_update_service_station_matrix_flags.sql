-- Add configuration flags to service_station_matrix and remove legacy services.is_active
ALTER TABLE public.service_station_matrix
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS remote_booking_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_staff_approval BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.services
  DROP COLUMN IF EXISTS is_active;

