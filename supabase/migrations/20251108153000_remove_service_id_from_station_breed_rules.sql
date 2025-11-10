-- Remove service_id from station_breed_rules now that the matrix only tracks grooming

BEGIN;

ALTER TABLE public.station_breed_rules
  DROP CONSTRAINT IF EXISTS station_breed_rules_station_id_service_id_breed_id_key,
  DROP CONSTRAINT IF EXISTS station_breed_rules_service_id_fkey,
  DROP COLUMN IF EXISTS service_id;

ALTER TABLE public.station_breed_rules
  ADD CONSTRAINT station_breed_rules_station_id_breed_id_key UNIQUE (station_id, breed_id);

COMMIT;


