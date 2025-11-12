-- Extend unified appointments table with garden-specific columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS late_pickup_requested BOOLEAN,
  ADD COLUMN IF NOT EXISTS late_pickup_notes TEXT,
  ADD COLUMN IF NOT EXISTS garden_trim_nails BOOLEAN,
  ADD COLUMN IF NOT EXISTS garden_brush BOOLEAN,
  ADD COLUMN IF NOT EXISTS garden_bath BOOLEAN,
  ADD COLUMN IF NOT EXISTS questionnaire_result public.questionnaire_result;

-- Ensure questionnaire_result always has a value
UPDATE public.appointments
SET questionnaire_result = COALESCE(questionnaire_result, 'pending');

ALTER TABLE public.appointments
  ALTER COLUMN questionnaire_result SET NOT NULL,
  ALTER COLUMN questionnaire_result SET DEFAULT 'pending';

-- Provide compatibility views for legacy code paths
CREATE OR REPLACE VIEW public.daycare_appointments AS
SELECT
  id,
  airtable_id,
  customer_id,
  treatment_id,
  station_id,
  status,
  payment_status,
  service_type,
  start_at,
  end_at,
  series_id,
  late_pickup_requested,
  late_pickup_notes,
  amount_due,
  garden_trim_nails,
  garden_brush,
  garden_bath,
  customer_notes,
  internal_notes,
  questionnaire_result,
  created_at,
  updated_at
FROM public.appointments
WHERE service_type IS NOT NULL
  AND service_type <> ''
  AND service_type NOT IN ('grooming');

CREATE OR REPLACE VIEW public.grooming_appointments AS
SELECT
  id,
  airtable_id,
  customer_id,
  treatment_id,
  service_id,
  station_id,
  status,
  payment_status,
  appointment_kind,
  start_at,
  end_at,
  series_id,
  personal_reason,
  customer_notes,
  internal_notes,
  amount_due,
  billing_url,
  billing_triggered_at,
  pickup_reminder_sent_at,
  created_at,
  updated_at
FROM public.appointments
WHERE service_type IS NULL
   OR service_type = ''
   OR service_type = 'grooming';

