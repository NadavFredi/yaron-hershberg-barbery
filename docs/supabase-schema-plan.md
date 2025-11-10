# Supabase Data Model Plan

This document captures the target Postgres schema that will replace the existing Airtable base.  
It focuses on the core scheduling/customer workflows and keeps a one-to-one mapping (where practical) so we can migrate data with minimal transformation.

## Legend

- **Airtable Table / Field** – existing source entity.
- **Supabase Table.Column** – proposed destination.
- **Type** – Postgres type (with enum name if applicable).
- **Notes / Rules** – constraints, defaults, or data governance notes.

## Shared Enums

| Enum | Values | Notes |
|------|--------|-------|
| `customer_class` | `extra_vip`, `vip`, `existing`, `new` | Mirrors `סיווג לקוח`. |
| `treatment_gender` | `male`, `female` | From `מין`. |
| `appointment_status` | `pending`, `approved`, `cancelled`, `matched` | From `סטטוס התור`. |
| `payment_status` | `unpaid`, `paid`, `partial` | From `סטטוס תשלום`. |
| `ticket_type` | seeded from `סוגי כרטיסיות`. | Keeps reference integrity. |
| `service_type` | `grooming`, `daycare`, `both` | For combined operations. |
| `appointment_kind` | `business`, `personal` | From `סוג תור`. |
| `questionnaire_result` | `not_required`, `pending`, `approved`, `rejected` | Derived from questionnaire answers & staff review. |
| `absence_reason` | `sick`, `vacation`, `ad_hoc` | For station constraints (`סיבת ההיעדרות`). |

## Core Tables

### Customers (`public.customers`)

| Airtable Field | Supabase Column | Type | Notes |
|----------------|-----------------|------|-------|
| `מזהה רשומה` | `id` | `uuid` | Preserve Airtable record id during migration; use UUID for new rows. |
| `שם מלא` | `full_name` | `text` | Required. |
| `טלפון` | `phone` | `text` | Unique index with normalization. |
| `אימייל` | `email` | `text` | Nullable. |
| `תעודת זהות` | `gov_id` | `text` | Nullable; needs encryption/column masking later. |
| `כתובת` | `address` | `text` | Nullable. |
| `סיווג לקוח` | `classification` | `customer_class` | Default `new`. |
| `לשלוח חשבונית?` | `send_invoice` | `boolean` | Defaults false. |
| `לינק הודעת ווצאפ` | `whatsapp_link` | `text` | Generated from phone; can be a computed column. |
| `מספר טלפון לחיפוש` | `phone_search` | `text` | Computed/GIN index for search. |
| `created_time` | `created_at` | `timestamptz` | From Airtable `נוצר בתאריך`. |
| `updated_time` | `updated_at` | `timestamptz` | Trigger to update on change. |

Relations:
- links to `auth.users` via optional `auth_user_id`.
- 1-to-many with `treatments`, `tickets`, `payments`, `credit_tokens`.

### Treatments (`public.treatments`)

| Airtable Field | Supabase Column | Type | Notes |
|----------------|-----------------|------|-------|
| `מזהה רשומה` | `id` | `uuid` | Preserve if possible. |
| `לקוח` | `customer_id` | `uuid` | FK `customers(id)` cascades on delete. |
| `שם` | `name` | `text` | Required. |
| `מין` | `gender` | `treatment_gender` | Default `male`. |
| `גזע` | `treatment_type_id` | `uuid` | FK `treatmentTypes(id)`; optional. |
| `תאריך לידה כלב` | `birth_date` | `date` | Nullable. |
| `בעיות בריאות/אלרגיות` | `health_notes` | `text` | Nullable. |
| `שם הוטרינר` | `vet_name` | `text` | Nullable. |
| `טלפון של הוטרינר` | `vet_phone` | `text` | Nullable. |
| `משהו נוסף שחשוב שנדע` | `staff_notes` | `text` | Nullable; convert mention tokens to markdown/plain text. |
| `האם הכלב קטן?` | `is_small` | `boolean` | Derived from treatmentType size or manual override. |
| `האם הכלב עלול להפגין תוקפנות...` | `aggression_risk` | `boolean` | Derived from questionnaire. |
| `האם הכלב נוטה לנשוך...` | `people_anxious` | `boolean` | Derived from questionnaire. |
| `האם נמצא מתאים לגן מהשאלון` | `questionnaire_result` | `questionnaire_result` | Denormalized for fast checks. |
| `שאלון התאמה לגן` | handled via join table `garden_questionnaires`. |
| `created_time/updated_time` | `created_at` / `updated_at` | `timestamptz`. |

Derived FKs:
- Join tables `treatment_garden_registrations` (history of daycare attendance).
- Many-to-many to `tickets` via `ticket_usages`.

### TreatmentTypes (`public.treatmentTypes`)

| Airtable Field | Supabase Column | Type | Notes |
| `מזהה רשומה` | `id` | `uuid` | Keep parity. |
| `גזע` | `name` | `text` | Unique. |
| `גודל כלב` | `size_class` | `text` | Values: `small`, `medium`, `large`, `medium_large`. |
| `דורש אישור מיוחד` | `requires_staff_approval` | `boolean`. |
| `מחיר מינימום טיפול מספרה` | `min_groom_price` | `numeric(10,2)`. |
| `מחיר מקסימום טיפול במספרה` | `max_groom_price` | `numeric(10,2)`. |
| Additional lookups (questionnaires) -> separate bridging tables. |

### Services (`public.services`) – already exists

Augment columns:
- `category` enum (`grooming`, `daycare`, `retail`).
- `active` boolean.

### Stations (`public.stations`)

Add columns:
- `calendar_id` -> rename existing `google_calendar_id`.
- `work_start` / `work_end` (time).
- `working_days` -> array of weekdays.

### Station Constraints (`public.station_unavailability`)

| Airtable Field | Supabase Column | Type |
| `עמדת עבודה` | `station_id` | `uuid` |
| `מועד תחילת ההיעדרות` | `start_time` | `timestamptz` |
| `מועד סיום ההיעדרות` | `end_time` | `timestamptz` |
| `סיבת ההיעדרות` | `reason` | `absence_reason` |
| `פירוט היעדרות` | `notes` | `jsonb` (store rich text) |
| Audit columns. |

### Appointments – Grooming (`public.grooming_appointments`)

| Airtable Field | Supabase Column | Type | Notes |
| `מזהה רשומה` | `id` | `uuid` |
| `כלב` | `treatment_id` | `uuid` |
| `לקוח` | `customer_id` | `uuid` | Redundant but keeps query simple. |
| `מועד התור` | `start_at` | `timestamptz` |
| `מועד סיום התור` | `end_at` | `timestamptz` |
| `עמדה` | `station_id` | `uuid` |
| `סוג טיפול` | `service_id` | `uuid` |
| `סטטוס התור` | `status` | `appointment_status` |
| `סטטוס תשלום` | `payment_status` | `payment_status` |
| `האם יום לפני תור והשעה 9:00` | derived job. |
| `מזהה קבוצת תורים` | `series_id` | `text` | For recurring sets. |
| `סוג תור` | `appointment_kind` | `appointment_kind` |
| `תיאור תור אישי` | `personal_reason` | `text` |
| `האם תור אישי` | computed bool. |
| `הערות ובקשות לתור` | `customer_notes` | `text` (store plain). |
| `הערות צוות פנימי` | `internal_notes` | `text`. |
| `סכום לתשלום` | `amount_due` | `numeric(10,2)` |
| `שלח לחיוב נוסחא / חיוב באמצעות המערכת` | convert to `billing_url` + `billing_triggered_at`. |
| `שלח הודעה הכלב שלך מוכן...` | track as `pickup_reminder_sent_at`. |
| `תור לגן` | `daycare_appointment_id` | `uuid` nullable – for combined flows. |
| `created/updated` timestamps. |

Indexes:
- `(customer_id, start_at)`, `(treatment_id, start_at)`, `(station_id, start_at)`.
- Unique constraint on `(station_id, start_at)` with tolerance for cancellations via partial index.

### Appointments – Daycare (`public.daycare_appointments`)

Similar columns plus daycare-specific fields:
- `service_type` (daycare type `full_day`, `trial`, `hourly`).
- `late_pickup_requested` / `notes`.
- Grooming combos reference `grooming_appointment_id`.
- `questionnaire_status` snapshot.

### Waiting List (`public.daycare_waitlist`)

| Field | Column | Notes |
| `כלב` | `treatment_id` |
| `לקוח` | `customer_id` |
| `שירות` | `service_type` enum (values `grooming`, `daycare`). |
| `מועד תחילת המתנה`/`סיום` | `start_date`, `end_date` (`daterange` as well). |
| `status` | `enum` (`active`, `fulfilled`, `cancelled`). |
| `notes` | `text`. |

A history table `daycare_waitlist_history` keeps transitions.

### Garden Questionnaire (`public.garden_questionnaires`)

| Airtable Field | Column | Type |
| `מזהה רשומה` | `id` | `uuid` |
| `כלב` | `treatment_id` | `uuid` |
| `האם הכלב עלול להפגין תוקפנות...` | `aggressive_towards_treatments` | `boolean` |
| `האם הכלב נוטה לנשוך אנשים...` | `bites_people` | `boolean` |
| `אישר תקנון גן` | `terms_accepted` | `boolean` |
| `תמונת הכלב` | store in Supabase Storage, keep URL + metadata. |
| `staff_reviewed_by` | `uuid` -> `profiles`. |
| `staff_comment` | `text`. |
| `result` | `questionnaire_result`. |
| Timestamps. |

### Tickets (`public.tickets`)

Captures `כרטיסיות`.

| Airtable Field | Column |
| `מזהה רשומה` | `id` (uuid) |
| `לקוחות` | `customer_id` |
| `סוג כרטיסייה` | `ticket_type` |
| `תוקף כרטיסייה` | `expires_on` (date) |
| `כמות כניסות בכרטיסיה הנבחרת` | `total_entries` |
| `ניצול כרטיסיה עד כה` | derived with `ticket_usages`. |
| `יתרה לניצול` | computed view. |
| `האם הכרטיסייה פעילה` | computed boolean (validity + remaining > 0). |

`ticket_types` table seeded from Airtable with price & description.

### Ticket Usage (`public.ticket_usages`)

Represents `ניצול כרטיסיות`.

| Field | Column |
| `מזהה רשומה` | `id` |
| `כרטיסיות` | `ticket_id` |
| `כלב` | `treatment_id` |
| `ניצול כרטיסיה` | `units_used` (`numeric(4,1)` for partial hours). |
| `תור לגן/תור למספרה` | `daycare_appointment_id` / `grooming_appointment_id` |
| `timestamp` | `used_at` |

### Payments (`public.payments`)

Combines `תשלומים`, `טוקן אשראי`, and billing hooks.

| Column | Type | Notes |
| `id` | `uuid` |
| `customer_id` | `uuid` |
| `amount` | `numeric(10,2)` |
| `currency` | `text` default `ILS`. |
| `status` | `payment_status`. |
| `method` | `text` (`cash`, `card_token`, `transfer`, etc.). |
| `token_id` | FK to `credit_tokens`. |
| `external_reference` | `text` (Make/Stripe). |
| `meta` | `jsonb` (response payload). |
| `created_at` | timestamptz. |

### Credit Tokens (`public.credit_tokens`)

| Field | Column | Type |
| `מזהה רשומה` | `id` | `uuid` |
| `לקוח` | `customer_id` | |
| `טוקן` | `token` | `text` (encrypted). |
| `CVV` | `cvv` | `text` (if stored, encrypt or drop if not compliant). |
| `ספרות אחרונות` | `last4` | `text`. |
| `provider` | `text` (Make/Tranzila). |
| `created_at` | timestamp. |

### Products & Orders

- `public.products` replicates Airtable `מוצרים`.
- `public.orders` (for `הזמנה`) with `customer_id`, `grooming_appointment_id`, `daycare_appointment_id`, `status`, totals.
- `public.order_items` (`פריט הזמנה`) linking orders to products, storing unit price & quantity.

### Scheduling Metadata

- `public.station_treatmentType_rules` replicates `עמדות מול גזעים` linking station, treatmentType, service with durations/pricing adjustments.
- `public.station_availability` (optional materialized view) merges working hours with `station_unavailability`.
- `public.capacity_limits` for `תקרת שיבוצים בגן`.
- `public.operating_hours` for `שעות פעילות`.

## Relationships Overview

- **customers ⇄ treatments (1:n)**  
- **treatments ⇄ grooming_appointments/daycare_appointments (1:n)**  
- **customers ⇄ tickets (1:n)**, **tickets ⇄ ticket_usages (1:n)**, **ticket_usages ⇄ appointments (n:1)**  
- **treatments ⇄ garden_questionnaires (1:1 latest)**  
- **stations ⇄ station_unavailability (1:n)**  
- **stations ⇄ station_treatmentType_rules (1:n)**, **services ⇄ station_treatmentType_rules (1:n)**  
- **appointments ⇄ payments (n:m)** via `appointment_payments` join for split payments.  
- **orders ⇄ order_items ⇄ products**.  
- **daycare_waitlist ⇄ treatments/customers** maintains history.

## Migration Notes

1. **Record IDs** – Store Airtable `recXXXX` IDs in dedicated columns (or reuse as primary keys during migration) to simplify cutover validation. After migration we can switch to generated UUIDs for new records.
2. **Attachments** – Move images (questionnaires, treatment photos) into Supabase Storage buckets (`treatments`, `questionnaires`). Store metadata in associated tables.
3. **Formulas** – Replace with generated columns, views, or background jobs:
   - Example: `האם יום לפני תור והשעה 9:00` → scheduled function runs hourly and sends reminders + sets `reminder_sent_at`.
   - `האם שבוע לפני וכרטיסייה...` → background job scanning upcoming expirations.
4. **Rich Text** – Airtable rich text exports as JSON. Store as `jsonb` or convert to Markdown before seeding.
5. **RLS Policies** – Start permissive for internal tools (authenticated staff role). For customer-facing portal enforce:
   - Customers read their own records (`customer_id` via JWT claim).
   - Staff role (from `profiles.role`) full access.
6. **Edge Functions** – Each existing function should map to either:
   - Direct client query (`supabase-js` with filters).
   - RPC (`create_appointment`, `cancel_appointment`) executing transactional logic (ticket deduction + appointment creation).
   - Cron-triggered function (reminders, waitlist sweeps).
7. **Data Quality** – Prior to seeding, export Airtable tables as CSV/JSON with consistent encodings (UTF-8). Normalize phone numbers, convert Hebrew text to UTF-8.

## Next Steps

1. Generate Supabase migrations reflecting the tables above (`supabase db gen migration`).  
2. Define enums & helper functions in SQL (`CREATE TYPE`, `CREATE FUNCTION`).  
3. Seed reference data: ticket types, services, treatmentTypes, station capacities.  
4. Implement row-level security policies (customers vs staff) and attach to JWT claims.  
5. Begin porting edge functions to Supabase RPC after schema exists.  
6. Write migration scripts to load Airtable data (Node script or Supabase `db seed`).  
7. Update the frontend API layer to use the new tables and remove Airtable references.

