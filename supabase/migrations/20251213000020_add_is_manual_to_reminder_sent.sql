-- Add is_manual column to appointment_reminder_sent table
-- This column indicates whether the reminder that was sent was a manual reminder or automatic

ALTER TABLE public.appointment_reminder_sent
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.appointment_reminder_sent.is_manual IS 
    'Whether the reminder that was sent was a manual reminder (can be sent on demand) or an automatic reminder.';
