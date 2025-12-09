-- Add specific_time and send_condition columns to appointment_reminders table
-- specific_time: TIME type for specifying exact time (e.g., 18:00) when reminder should be sent
-- send_condition: TEXT enum for 'send_only_if_not_approved' or 'send_anyway'

-- Add specific_time column (nullable - if null, reminder is relative)
ALTER TABLE public.appointment_reminders
ADD COLUMN IF NOT EXISTS specific_time TIME;

-- Add send_condition column (nullable - defaults to 'send_anyway' behavior if null)
ALTER TABLE public.appointment_reminders
ADD COLUMN IF NOT EXISTS send_condition TEXT;

-- Add constraint to ensure send_condition is one of the valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'appointment_reminders_send_condition_check'
    ) THEN
        ALTER TABLE public.appointment_reminders
        ADD CONSTRAINT appointment_reminders_send_condition_check 
        CHECK (send_condition IS NULL OR send_condition IN ('send_only_if_not_approved', 'send_anyway'));
    END IF;
END $$;

-- Add comment to explain the columns
COMMENT ON COLUMN public.appointment_reminders.specific_time IS 
    'Specific time of day to send reminder (e.g., 18:00). If NULL, reminder is sent relative to appointment time based on reminder_days/reminder_hours.';

COMMENT ON COLUMN public.appointment_reminders.send_condition IS 
    'Condition for sending reminder: "send_only_if_not_approved" (only if appointment status is pending) or "send_anyway" (regardless of status). If NULL, defaults to "send_anyway" behavior.';
