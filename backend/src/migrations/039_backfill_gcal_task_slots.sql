-- =============================================================================
-- Migration: 039_backfill_gcal_task_slots.sql
-- Description: Backfills task_slots for Google Calendar-imported org tasks that
--              were created before the slot-creation fix was added to
--              processIncomingGoogleEvent. Without a task_slots row, these tasks
--              are invisible in the calendar view.
--
-- SAFETY: Idempotent — uses LEFT JOIN + IS NULL to only insert for tasks that
--         genuinely have no existing slot. Safe to re-run.
-- =============================================================================

INSERT INTO public.task_slots (task_id, user_id, start_date, due_date, is_all_day)
SELECT
    t.id,
    t.created_by,
    t.start_date,
    t.due_date,
    COALESCE(t.is_all_day, FALSE)
FROM public.tasks t
LEFT JOIN public.task_slots ts ON ts.task_id = t.id
WHERE t.google_event_id IS NOT NULL
  AND t.start_date IS NOT NULL
  AND t.due_date IS NOT NULL
  AND t.deleted_at IS NULL
  AND ts.id IS NULL;
