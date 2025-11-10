-- Seed data to support development/staging environments.
-- Safe to run multiple times thanks to ON CONFLICT clauses.

INSERT INTO public.business_hours (id, weekday, open_time, close_time, shift_order)
VALUES
  (gen_random_uuid(), 'sunday', '08:00', '19:00', 0),
  (gen_random_uuid(), 'monday', '08:00', '17:00', 0),
  (gen_random_uuid(), 'tuesday', '08:00', '17:00', 0),
  (gen_random_uuid(), 'wednesday', '11:30', '17:00', 0),
  (gen_random_uuid(), 'thursday', '09:00', '17:00', 0),
  (gen_random_uuid(), 'friday', '08:00', '17:00', 0),
  (gen_random_uuid(), 'saturday', '08:00', '17:00', 0)
ON CONFLICT (weekday, shift_order) DO UPDATE
SET open_time = EXCLUDED.open_time,
    close_time = EXCLUDED.close_time,
    updated_at = now();

INSERT INTO public.daycare_capacity_limits (id, effective_date, trial_limit, regular_limit)
VALUES
  (gen_random_uuid(), DATE '2025-01-01', 3, 10)
ON CONFLICT (effective_date) DO UPDATE
SET trial_limit = EXCLUDED.trial_limit,
    regular_limit = EXCLUDED.regular_limit,
    updated_at = now();

INSERT INTO public.ticket_types (id, name, price, description, total_entries, is_unlimited)
VALUES
  (gen_random_uuid(), 'מעבר חופשי לחודש', 500, 'כניסה חופשית לכל סוגי הטיפולים למשך חודש שלם – ללא הגבלה.', NULL, true),
  (gen_random_uuid(), 'כרטיסייה ל-12 טיפולים', 800, 'טיפוח קבוע לאורך השנה עם פינוקים מיוחדים.', 12, false),
  (gen_random_uuid(), 'כרטיסייה ל-6 טיפולים', 450, 'שגרת טיפוח דו-חודשית כולל תור מהיר.', 6, false)
ON CONFLICT (name) DO UPDATE
SET price = EXCLUDED.price,
    description = EXCLUDED.description,
    total_entries = EXCLUDED.total_entries,
    is_unlimited = EXCLUDED.is_unlimited,
    updated_at = now();
