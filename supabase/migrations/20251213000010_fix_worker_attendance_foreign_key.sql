-- Fix worker_attendance_logs foreign key to reference profiles instead of auth.users
-- Drop the existing foreign key constraints
ALTER TABLE IF EXISTS public.worker_attendance_logs
    DROP CONSTRAINT IF EXISTS worker_attendance_logs_worker_id_fkey;

ALTER TABLE IF EXISTS public.worker_attendance_logs
    DROP CONSTRAINT IF EXISTS worker_attendance_logs_created_by_fkey;

ALTER TABLE IF EXISTS public.worker_attendance_logs
    DROP CONSTRAINT IF EXISTS worker_attendance_logs_closed_by_fkey;

-- Add new foreign key constraints pointing to profiles
ALTER TABLE public.worker_attendance_logs
    ADD CONSTRAINT worker_attendance_logs_worker_id_fkey 
    FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.worker_attendance_logs
    ADD CONSTRAINT worker_attendance_logs_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.worker_attendance_logs
    ADD CONSTRAINT worker_attendance_logs_closed_by_fkey 
    FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
