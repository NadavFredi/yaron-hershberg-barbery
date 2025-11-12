DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meeting_invites'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.proposed_meeting_invites RENAME COLUMN meeting_id TO proposed_meeting_id';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proposed_meeting_invites_meeting_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.proposed_meeting_invites RENAME CONSTRAINT proposed_meeting_invites_meeting_id_fkey TO proposed_meeting_invites_proposed_meeting_id_fkey';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposed_meeting_categories'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.proposed_meeting_categories RENAME COLUMN meeting_id TO proposed_meeting_id';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proposed_meeting_categories_meeting_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.proposed_meeting_categories RENAME CONSTRAINT proposed_meeting_categories_meeting_id_fkey TO proposed_meeting_categories_proposed_meeting_id_fkey';
  END IF;
END;
$$;

