-- Add is_manual and is_default columns to appointment_reminders table
-- is_manual: BOOLEAN to distinguish manual reminders from automatic ones
-- is_default: BOOLEAN to mark a default reminder (only used for manual reminders)

-- Add is_manual column
ALTER TABLE public.appointment_reminders
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

-- Add is_default column
ALTER TABLE public.appointment_reminders
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Update the day_type constraint to allow 'manual' as a valid value
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'appointment_reminders_day_type_check'
    ) THEN
        ALTER TABLE public.appointment_reminders
        DROP CONSTRAINT appointment_reminders_day_type_check;
    END IF;
    
    -- Add the updated constraint that includes 'manual'
    ALTER TABLE public.appointment_reminders
    ADD CONSTRAINT appointment_reminders_day_type_check 
    CHECK (day_type IN ('regular', 'sunday', 'manual'));
END $$;

-- Update the timing check constraint to allow NULL for manual reminders
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'appointment_reminders_timing_check'
    ) THEN
        ALTER TABLE public.appointment_reminders
        DROP CONSTRAINT appointment_reminders_timing_check;
    END IF;
    
    -- Add the updated constraint that allows NULL for manual reminders
    ALTER TABLE public.appointment_reminders
    ADD CONSTRAINT appointment_reminders_timing_check 
    CHECK (
        (is_manual = true) OR 
        ((reminder_days IS NOT NULL) OR (reminder_hours IS NOT NULL))
    );
END $$;

-- Add comments to explain the columns
COMMENT ON COLUMN public.appointment_reminders.is_manual IS 
    'Whether this is a manual reminder (can be sent on demand) or an automatic reminder.';

COMMENT ON COLUMN public.appointment_reminders.is_default IS 
    'Whether this is the default manual reminder. Only one manual reminder can be marked as default.';
