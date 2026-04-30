-- =============================================================================
-- Migration: 005_platform_organisation_space_schema.sql
-- Description: Adds platform-level personal tasks and organisation/space
--              tenancy foundations while preserving existing workspace APIs.
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUMS
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'space_visibility'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.space_visibility AS ENUM ('private');
    END IF;
END;
$$;


-- =============================================================================
-- SECTION 2: ORGANISATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organisations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    owner_user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    source_workspace_id UUID        UNIQUE REFERENCES public.workspaces(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- CREATE TABLE IF NOT EXISTS does not reconcile an already-created partial table.
-- Keep these ALTERs so rerunning after a failed migration can recover safely.
ALTER TABLE public.organisations
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS source_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.organisations
SET id = gen_random_uuid()
WHERE id IS NULL;

COMMENT ON TABLE public.organisations IS
    'Primary tenancy boundary for organisation-owned product data.';
COMMENT ON COLUMN public.organisations.source_workspace_id IS
    'Compatibility mapping to the legacy workspace used during the workspace-to-organisation migration.';

WITH duplicate_source_workspaces AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY source_workspace_id
            ORDER BY created_at ASC, id ASC
        ) AS source_rank
    FROM public.organisations
    WHERE source_workspace_id IS NOT NULL
)
UPDATE public.organisations o
SET source_workspace_id = NULL
FROM duplicate_source_workspaces d
WHERE o.id = d.id
  AND d.source_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_id_unique
    ON public.organisations(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_source_workspace_id_unique
    ON public.organisations(source_workspace_id);

CREATE INDEX IF NOT EXISTS idx_organisations_owner_user_id
    ON public.organisations(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_organisations_deleted_at
    ON public.organisations(deleted_at)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS organisations_set_updated_at ON public.organisations;
CREATE TRIGGER organisations_set_updated_at
    BEFORE UPDATE ON public.organisations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 3: ORGANISATION MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organisation_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID        NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role        member_role NOT NULL DEFAULT 'member',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organisation_members_unique_org_user UNIQUE (org_id, user_id)
);

-- Reconcile partial tables left by failed migration attempts.
ALTER TABLE public.organisation_members
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS role member_role NOT NULL DEFAULT 'member',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.organisation_members
SET id = gen_random_uuid()
WHERE id IS NULL;

COMMENT ON TABLE public.organisation_members IS
    'Users can belong to multiple organisations; uniqueness is scoped to one organisation.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisation_members_org_user_unique
    ON public.organisation_members(org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_organisation_members_user_id
    ON public.organisation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organisation_members_org_id
    ON public.organisation_members(org_id);


-- =============================================================================
-- SECTION 4: SPACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.spaces (
    id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID             REFERENCES public.workspaces(id) ON DELETE SET NULL,
    org_id              UUID             NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name                TEXT             NOT NULL,
    visibility          space_visibility NOT NULL DEFAULT 'private',
    created_by          UUID             REFERENCES public.users(id) ON DELETE SET NULL,
    source_workspace_id UUID             UNIQUE REFERENCES public.workspaces(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT spaces_unique_id_org UNIQUE (id, org_id)
);

-- CREATE TABLE IF NOT EXISTS does not reconcile an already-created partial table.
-- Keep these ALTERs so rerunning after a failed migration can recover safely.
ALTER TABLE public.spaces
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS visibility public.space_visibility NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.spaces
SET id = gen_random_uuid()
WHERE id IS NULL;

COMMENT ON TABLE public.spaces IS
    'Private visibility boundary inside an organisation.';
COMMENT ON COLUMN public.spaces.source_workspace_id IS
    'Compatibility mapping for the default space created from a legacy workspace.';

WITH duplicate_source_workspaces AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY source_workspace_id
            ORDER BY created_at ASC, id ASC
        ) AS source_rank
    FROM public.spaces
    WHERE source_workspace_id IS NOT NULL
)
UPDATE public.spaces s
SET source_workspace_id = NULL
FROM duplicate_source_workspaces d
WHERE s.id = d.id
  AND d.source_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_source_workspace_id_unique
    ON public.spaces(source_workspace_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'spaces_unique_id_org'
          AND conrelid = 'public.spaces'::regclass
    ) THEN
        ALTER TABLE public.spaces
            ADD CONSTRAINT spaces_unique_id_org UNIQUE (id, org_id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_spaces_org_id
    ON public.spaces(org_id);

CREATE INDEX IF NOT EXISTS idx_spaces_deleted_at
    ON public.spaces(deleted_at)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS spaces_set_updated_at ON public.spaces;
CREATE TRIGGER spaces_set_updated_at
    BEFORE UPDATE ON public.spaces
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 5: SPACE MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.space_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID        NOT NULL,
    space_id    UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    role        member_role NOT NULL DEFAULT 'member',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT space_members_unique_space_user UNIQUE (space_id, user_id),
    CONSTRAINT space_members_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.organisations(id)
        ON DELETE CASCADE,
    CONSTRAINT space_members_space_org_fk
        FOREIGN KEY (space_id, org_id)
        REFERENCES public.spaces(id, org_id)
        ON DELETE CASCADE,
    CONSTRAINT space_members_org_user_fk
        FOREIGN KEY (org_id, user_id)
        REFERENCES public.organisation_members(org_id, user_id)
        ON DELETE CASCADE
);

-- Reconcile partial tables left by failed migration attempts.
ALTER TABLE public.space_members
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD COLUMN IF NOT EXISTS space_id UUID,
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS role member_role NOT NULL DEFAULT 'member',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.space_members
SET id = gen_random_uuid()
WHERE id IS NULL;

COMMENT ON TABLE public.space_members IS
    'Users visible inside a private organisation space. A user must also be an organisation member.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_space_members_space_user_unique
    ON public.space_members(space_id, user_id);

CREATE INDEX IF NOT EXISTS idx_space_members_org_id
    ON public.space_members(org_id);

CREATE INDEX IF NOT EXISTS idx_space_members_space_id
    ON public.space_members(space_id);

CREATE INDEX IF NOT EXISTS idx_space_members_user_id
    ON public.space_members(user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organisation_members_org_fk'
          AND conrelid = 'public.organisation_members'::regclass
    ) THEN
        ALTER TABLE public.organisation_members
            ADD CONSTRAINT organisation_members_org_fk
            FOREIGN KEY (org_id)
            REFERENCES public.organisations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organisation_members_user_fk'
          AND conrelid = 'public.organisation_members'::regclass
    ) THEN
        ALTER TABLE public.organisation_members
            ADD CONSTRAINT organisation_members_user_fk
            FOREIGN KEY (user_id)
            REFERENCES public.users(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'space_members_org_fk'
          AND conrelid = 'public.space_members'::regclass
    ) THEN
        ALTER TABLE public.space_members
            ADD CONSTRAINT space_members_org_fk
            FOREIGN KEY (org_id)
            REFERENCES public.organisations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'space_members_space_org_fk'
          AND conrelid = 'public.space_members'::regclass
    ) THEN
        ALTER TABLE public.space_members
            ADD CONSTRAINT space_members_space_org_fk
            FOREIGN KEY (space_id, org_id)
            REFERENCES public.spaces(id, org_id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'space_members_org_user_fk'
          AND conrelid = 'public.space_members'::regclass
    ) THEN
        ALTER TABLE public.space_members
            ADD CONSTRAINT space_members_org_user_fk
            FOREIGN KEY (org_id, user_id)
            REFERENCES public.organisation_members(org_id, user_id)
            ON DELETE CASCADE;
    END IF;
END;
$$;


-- =============================================================================
-- SECTION 6: PERSONAL TASKS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.personal_tasks (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_task_id      UUID          REFERENCES public.personal_tasks(id) ON DELETE CASCADE,
    title               TEXT          NOT NULL,
    description         TEXT,
    objective           TEXT,
    success_criteria    TEXT,
    status              task_status   NOT NULL DEFAULT 'backlog',
    priority            task_priority NOT NULL DEFAULT 'medium',
    start_date          TIMESTAMPTZ,
    due_date            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT personal_task_date_order CHECK (
        due_date IS NULL OR start_date IS NULL OR due_date >= start_date
    )
);

-- Reconcile partial tables left by failed migration attempts.
ALTER TABLE public.personal_tasks
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.personal_tasks(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS objective TEXT,
    ADD COLUMN IF NOT EXISTS success_criteria TEXT,
    ADD COLUMN IF NOT EXISTS status task_status NOT NULL DEFAULT 'backlog',
    ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.personal_tasks
SET id = gen_random_uuid()
WHERE id IS NULL;

COMMENT ON TABLE public.personal_tasks IS
    'Platform-owned task data visible only to the owning user. Never references organisations or spaces.';

CREATE INDEX IF NOT EXISTS idx_personal_tasks_owner_user_id
    ON public.personal_tasks(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_parent_task_id
    ON public.personal_tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_status
    ON public.personal_tasks(status);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_due_date
    ON public.personal_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_deleted_at
    ON public.personal_tasks(deleted_at)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS personal_tasks_set_updated_at ON public.personal_tasks;
CREATE TRIGGER personal_tasks_set_updated_at
    BEFORE UPDATE ON public.personal_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 7: DEFAULT ORGANISATION / SPACE HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_workspace_organisation(p_workspace_id UUID)
RETURNS TABLE(org_id UUID, space_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    v_workspace public.workspaces%ROWTYPE;
    v_org_id UUID;
    v_space_id UUID;
BEGIN
    SELECT *
    INTO v_workspace
    FROM public.workspaces
    WHERE id = p_workspace_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace % does not exist', p_workspace_id;
    END IF;

    INSERT INTO public.organisations (
        name,
        owner_user_id,
        source_workspace_id,
        created_at,
        deleted_at
    )
    VALUES (
        v_workspace.name,
        v_workspace.owner_id,
        v_workspace.id,
        v_workspace.created_at,
        v_workspace.deleted_at
    )
    ON CONFLICT (source_workspace_id)
    DO UPDATE SET
        name = EXCLUDED.name,
        owner_user_id = EXCLUDED.owner_user_id,
        deleted_at = EXCLUDED.deleted_at
    RETURNING id INTO v_org_id;

    SELECT s.id
    INTO v_space_id
    FROM public.spaces s
    WHERE s.source_workspace_id = v_workspace.id
       OR s.workspace_id = v_workspace.id
    ORDER BY
        CASE WHEN s.source_workspace_id = v_workspace.id THEN 0 ELSE 1 END,
        s.created_at ASC,
        s.id ASC
    LIMIT 1;

    IF v_space_id IS NULL THEN
        INSERT INTO public.spaces (
            workspace_id,
            org_id,
            name,
            visibility,
            created_by,
            source_workspace_id,
            created_at,
            deleted_at
        )
        VALUES (
            v_workspace.id,
            v_org_id,
            'General',
            'private',
            v_workspace.owner_id,
            v_workspace.id,
            v_workspace.created_at,
            v_workspace.deleted_at
        )
        RETURNING id INTO v_space_id;
    ELSE
        UPDATE public.spaces s
        SET
            workspace_id = COALESCE(s.workspace_id, v_workspace.id),
            org_id = v_org_id,
            source_workspace_id = CASE
                WHEN s.source_workspace_id IS NOT NULL THEN s.source_workspace_id
                WHEN NOT EXISTS (
                    SELECT 1
                    FROM public.spaces sx
                    WHERE sx.source_workspace_id = v_workspace.id
                      AND sx.id <> s.id
                ) THEN v_workspace.id
                ELSE s.source_workspace_id
            END,
            deleted_at = COALESCE(s.deleted_at, v_workspace.deleted_at)
        WHERE s.id = v_space_id
        RETURNING s.id INTO v_space_id;
    END IF;

    RETURN QUERY SELECT v_org_id, v_space_id;
END;
$$;


-- =============================================================================
-- SECTION 8: BACKFILL EXISTING WORKSPACE DATA
-- =============================================================================

DO $$
DECLARE
    v_workspace_id UUID;
BEGIN
    FOR v_workspace_id IN
        SELECT id FROM public.workspaces
    LOOP
        PERFORM public.ensure_workspace_organisation(v_workspace_id);
    END LOOP;
END;
$$;

INSERT INTO public.organisation_members (
    org_id,
    user_id,
    role,
    created_at
)
SELECT
    o.id,
    wm.user_id,
    wm.role,
    wm.created_at
FROM public.workspace_members wm
INNER JOIN public.organisations o
    ON o.source_workspace_id = wm.workspace_id
ON CONFLICT (org_id, user_id)
DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.space_members (
    org_id,
    space_id,
    user_id,
    role,
    created_at
)
SELECT
    o.id,
    s.id,
    wm.user_id,
    wm.role,
    wm.created_at
FROM public.workspace_members wm
INNER JOIN public.organisations o
    ON o.source_workspace_id = wm.workspace_id
INNER JOIN public.spaces s
    ON s.source_workspace_id = wm.workspace_id
ON CONFLICT (space_id, user_id)
DO UPDATE SET
    org_id = EXCLUDED.org_id,
    role = EXCLUDED.role;

UPDATE public.spaces s
SET org_id = o.id
FROM public.organisations o
WHERE s.workspace_id = o.source_workspace_id
  AND s.org_id IS NULL;

UPDATE public.space_members sm
SET org_id = s.org_id
FROM public.spaces s
WHERE sm.space_id = s.id
  AND sm.org_id IS NULL;


-- =============================================================================
-- SECTION 9: ADD ORGANISATION / SPACE COLUMNS TO EXISTING ORG-OWNED DATA
-- =============================================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD COLUMN IF NOT EXISTS space_id UUID;

ALTER TABLE public.channels
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD COLUMN IF NOT EXISTS space_id UUID;

ALTER TABLE public.activity_logs
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD COLUMN IF NOT EXISTS space_id UUID;

UPDATE public.tasks t
SET
    org_id = o.id,
    space_id = s.id
FROM public.organisations o
INNER JOIN public.spaces s
    ON s.source_workspace_id = o.source_workspace_id
WHERE t.workspace_id = o.source_workspace_id
  AND (t.org_id IS NULL OR t.space_id IS NULL);

UPDATE public.channels c
SET
    org_id = o.id,
    space_id = s.id
FROM public.organisations o
INNER JOIN public.spaces s
    ON s.source_workspace_id = o.source_workspace_id
WHERE c.workspace_id = o.source_workspace_id
  AND (c.org_id IS NULL OR c.space_id IS NULL);

UPDATE public.activity_logs al
SET
    org_id = o.id,
    space_id = s.id
FROM public.organisations o
INNER JOIN public.spaces s
    ON s.source_workspace_id = o.source_workspace_id
WHERE al.workspace_id = o.source_workspace_id
  AND al.org_id IS NULL;


-- =============================================================================
-- SECTION 10: ORGANISATION / SPACE COLUMN CONSTRAINTS
-- =============================================================================

ALTER TABLE public.tasks
    ALTER COLUMN org_id SET NOT NULL,
    ALTER COLUMN space_id SET NOT NULL;

ALTER TABLE public.channels
    ALTER COLUMN org_id SET NOT NULL,
    ALTER COLUMN space_id SET NOT NULL;

ALTER TABLE public.activity_logs
    ALTER COLUMN org_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tasks_org_fk'
          AND conrelid = 'public.tasks'::regclass
    ) THEN
        ALTER TABLE public.tasks
            ADD CONSTRAINT tasks_org_fk
            FOREIGN KEY (org_id)
            REFERENCES public.organisations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tasks_space_org_fk'
          AND conrelid = 'public.tasks'::regclass
    ) THEN
        ALTER TABLE public.tasks
            ADD CONSTRAINT tasks_space_org_fk
            FOREIGN KEY (space_id, org_id)
            REFERENCES public.spaces(id, org_id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'channels_org_fk'
          AND conrelid = 'public.channels'::regclass
    ) THEN
        ALTER TABLE public.channels
            ADD CONSTRAINT channels_org_fk
            FOREIGN KEY (org_id)
            REFERENCES public.organisations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'channels_space_org_fk'
          AND conrelid = 'public.channels'::regclass
    ) THEN
        ALTER TABLE public.channels
            ADD CONSTRAINT channels_space_org_fk
            FOREIGN KEY (space_id, org_id)
            REFERENCES public.spaces(id, org_id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'activity_logs_org_fk'
          AND conrelid = 'public.activity_logs'::regclass
    ) THEN
        ALTER TABLE public.activity_logs
            ADD CONSTRAINT activity_logs_org_fk
            FOREIGN KEY (org_id)
            REFERENCES public.organisations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'activity_logs_space_org_fk'
          AND conrelid = 'public.activity_logs'::regclass
    ) THEN
        ALTER TABLE public.activity_logs
            ADD CONSTRAINT activity_logs_space_org_fk
            FOREIGN KEY (space_id, org_id)
            REFERENCES public.spaces(id, org_id)
            ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_org_space
    ON public.tasks(org_id, space_id);

CREATE INDEX IF NOT EXISTS idx_tasks_space_status_priority
    ON public.tasks(space_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_channels_org_space
    ON public.channels(org_id, space_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_space_created_at
    ON public.activity_logs(org_id, space_id, created_at DESC);


-- =============================================================================
-- SECTION 11: COMPATIBILITY SYNC TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_workspace_insert_to_organisation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
BEGIN
    SELECT e.org_id, e.space_id
    INTO v_org_id, v_space_id
    FROM public.ensure_workspace_organisation(NEW.id) e;

    INSERT INTO public.organisation_members (org_id, user_id, role, created_at)
    VALUES (v_org_id, NEW.owner_id, 'owner', NEW.created_at)
    ON CONFLICT (org_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    INSERT INTO public.space_members (org_id, space_id, user_id, role, created_at)
    VALUES (v_org_id, v_space_id, NEW.owner_id, 'owner', NEW.created_at)
    ON CONFLICT (space_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_sync_organisation ON public.workspaces;
CREATE TRIGGER workspaces_sync_organisation
    AFTER INSERT OR UPDATE OF name, owner_id, deleted_at ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_workspace_insert_to_organisation();


CREATE OR REPLACE FUNCTION public.sync_workspace_member_to_org_space()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_workspace_id UUID;
    v_org_id UUID;
    v_space_id UUID;
BEGIN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);

    SELECT e.org_id, e.space_id
    INTO v_org_id, v_space_id
    FROM public.ensure_workspace_organisation(v_workspace_id) e;

    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.space_members
        WHERE org_id = v_org_id
          AND space_id = v_space_id
          AND user_id = OLD.user_id;

        DELETE FROM public.organisation_members
        WHERE org_id = v_org_id
          AND user_id = OLD.user_id;

        RETURN OLD;
    END IF;

    INSERT INTO public.organisation_members (org_id, user_id, role, created_at)
    VALUES (v_org_id, NEW.user_id, NEW.role, NEW.created_at)
    ON CONFLICT (org_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    INSERT INTO public.space_members (org_id, space_id, user_id, role, created_at)
    VALUES (v_org_id, v_space_id, NEW.user_id, NEW.role, NEW.created_at)
    ON CONFLICT (space_id, user_id)
    DO UPDATE SET
        org_id = EXCLUDED.org_id,
        role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_members_sync_org_space ON public.workspace_members;
CREATE TRIGGER workspace_members_sync_org_space
    AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_workspace_member_to_org_space();


CREATE OR REPLACE FUNCTION public.fill_task_org_space_from_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
    v_parent_org_id UUID;
    v_parent_space_id UUID;
BEGIN
    IF NEW.org_id IS NULL OR NEW.space_id IS NULL THEN
        SELECT e.org_id, e.space_id
        INTO v_org_id, v_space_id
        FROM public.ensure_workspace_organisation(NEW.workspace_id) e;

        NEW.org_id := COALESCE(NEW.org_id, v_org_id);
        NEW.space_id := COALESCE(NEW.space_id, v_space_id);
    END IF;

    IF NEW.parent_task_id IS NOT NULL THEN
        SELECT org_id, space_id
        INTO v_parent_org_id, v_parent_space_id
        FROM public.tasks
        WHERE id = NEW.parent_task_id;

        IF v_parent_org_id IS DISTINCT FROM NEW.org_id
           OR v_parent_space_id IS DISTINCT FROM NEW.space_id THEN
            RAISE EXCEPTION 'Parent task must belong to the same organisation and space';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_fill_org_space ON public.tasks;
CREATE TRIGGER tasks_fill_org_space
    BEFORE INSERT OR UPDATE OF workspace_id, org_id, space_id, parent_task_id ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_task_org_space_from_workspace();


CREATE OR REPLACE FUNCTION public.fill_channel_org_space_from_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
BEGIN
    IF NEW.org_id IS NULL OR NEW.space_id IS NULL THEN
        SELECT e.org_id, e.space_id
        INTO v_org_id, v_space_id
        FROM public.ensure_workspace_organisation(NEW.workspace_id) e;

        NEW.org_id := COALESCE(NEW.org_id, v_org_id);
        NEW.space_id := COALESCE(NEW.space_id, v_space_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS channels_fill_org_space ON public.channels;
CREATE TRIGGER channels_fill_org_space
    BEFORE INSERT OR UPDATE OF workspace_id, org_id, space_id ON public.channels
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_channel_org_space_from_workspace();


CREATE OR REPLACE FUNCTION public.fill_activity_org_space_from_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
BEGIN
    IF NEW.org_id IS NULL THEN
        SELECT e.org_id, e.space_id
        INTO v_org_id, v_space_id
        FROM public.ensure_workspace_organisation(NEW.workspace_id) e;

        NEW.org_id := v_org_id;
        NEW.space_id := COALESCE(NEW.space_id, v_space_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_logs_fill_org_space ON public.activity_logs;
CREATE TRIGGER activity_logs_fill_org_space
    BEFORE INSERT OR UPDATE OF workspace_id, org_id, space_id ON public.activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_activity_org_space_from_workspace();


-- =============================================================================
-- SECTION 12: SPACE SAFETY TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_task_assignee_space_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
BEGIN
    SELECT org_id, space_id
    INTO v_org_id, v_space_id
    FROM public.tasks
    WHERE id = NEW.task_id;

    IF NOT EXISTS (
        SELECT 1
        FROM public.space_members sm
        WHERE sm.org_id = v_org_id
          AND sm.space_id = v_space_id
          AND sm.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Task assignee must be a member of the task space';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_assignees_enforce_space_member ON public.task_assignees;
CREATE TRIGGER task_assignees_enforce_space_member
    BEFORE INSERT OR UPDATE OF task_id, user_id ON public.task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_task_assignee_space_member();


CREATE OR REPLACE FUNCTION public.enforce_task_dependency_same_space()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_task_org_id UUID;
    v_task_space_id UUID;
    v_dep_org_id UUID;
    v_dep_space_id UUID;
BEGIN
    SELECT org_id, space_id
    INTO v_task_org_id, v_task_space_id
    FROM public.tasks
    WHERE id = NEW.task_id;

    SELECT org_id, space_id
    INTO v_dep_org_id, v_dep_space_id
    FROM public.tasks
    WHERE id = NEW.depends_on_task_id;

    IF v_task_org_id IS DISTINCT FROM v_dep_org_id
       OR v_task_space_id IS DISTINCT FROM v_dep_space_id THEN
        RAISE EXCEPTION 'Task dependencies must stay inside the same organisation and space';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_dependencies_enforce_same_space ON public.task_dependencies;
CREATE TRIGGER task_dependencies_enforce_same_space
    BEFORE INSERT OR UPDATE OF task_id, depends_on_task_id ON public.task_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_task_dependency_same_space();


-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================
