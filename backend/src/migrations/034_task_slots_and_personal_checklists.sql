-- Migration: 034_task_slots_and_personal_checklists.sql
-- Description: Creates task_slots and personal_checklists tables, adds slot deletion preferences, and transfers existing schedules.

-- 1. Create personal_checklists table
CREATE TABLE IF NOT EXISTS public.personal_checklists (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    is_completed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_checklists_task_id ON public.personal_checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_personal_checklists_user_id ON public.personal_checklists(user_id);

-- 2. Create task_slots table
CREATE TABLE IF NOT EXISTS public.task_slots (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    checklist_id   UUID REFERENCES public.personal_checklists(id) ON DELETE SET NULL,
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_date     TIMESTAMPTZ NOT NULL,
    due_date       TIMESTAMPTZ NOT NULL,
    is_all_day     BOOLEAN NOT NULL DEFAULT FALSE,
    status         VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_slots_task_id ON public.task_slots(task_id);
CREATE INDEX IF NOT EXISTS idx_task_slots_user_id ON public.task_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_task_slots_checklist_id ON public.task_slots(checklist_id);

-- 3. Add calendar slot deletion setting to user app preferences
ALTER TABLE public.user_app_preferences
    ADD COLUMN IF NOT EXISTS delete_slots_on_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Backfill existing task schedules into task_slots
INSERT INTO public.task_slots (task_id, user_id, start_date, due_date, is_all_day, status)
SELECT 
    id, 
    created_by, 
    start_date, 
    due_date, 
    COALESCE(is_all_day, FALSE), 
    'scheduled'
FROM public.tasks
WHERE start_date IS NOT NULL 
  AND due_date IS NOT NULL 
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
