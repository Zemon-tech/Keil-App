-- =============================================================================
-- CONSOLIDATED SCHEMA MIGRATION
-- Description: Single migration representing the final state of all schema
--              migrations (001 through 035). This is the canonical schema
--              for a fresh database setup.
-- =============================================================================

-- =============================================================================
-- SECTION 1: SCHEMAS
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS mastra;
GRANT USAGE ON SCHEMA mastra TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA mastra TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA mastra GRANT ALL ON TABLES TO postgres;

-- =============================================================================
-- SECTION 2: ENUMS
-- =============================================================================

CREATE TYPE task_status AS ENUM (
    'backlog',
    'todo',
    'in-progress',
    'done',
    'confirmed',
    'tentative',
    'cancelled',
    'completed'
);

CREATE TYPE task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

CREATE TYPE member_role AS ENUM (
    'owner',
    'admin',
    'member',
    'manager'
);

CREATE TYPE log_entity_type AS ENUM (
    'task',
    'comment',
    'workspace'
);

CREATE TYPE log_action_type AS ENUM (
    'task_created',
    'task_deleted',
    'status_changed',
    'priority_changed',
    'assignment_added',
    'assignment_removed',
    'due_date_changed',
    'start_date_changed',
    'dependency_added',
    'dependency_removed',
    'comment_created',
    'comment_deleted',
    'objective_updated',
    'success_criteria_updated',
    'title_updated',
    'description_updated'
);

CREATE TYPE space_visibility AS ENUM ('private');

CREATE TYPE motion_share_type AS ENUM ('public_link', 'space');

CREATE TYPE motion_permission AS ENUM (
    'view',
    'edit',
    'view_all',
    'view_managers',
    'view_admins',
    'edit_all',
    'edit_managers',
    'edit_admins'
);

CREATE TYPE gcal_watch_status AS ENUM ('pending', 'active', 'degraded', 'revoked');


-- =============================================================================
-- SECTION 3: USERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL UNIQUE,
    name        TEXT,
    avatar_url  TEXT        DEFAULT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
    'Public profile mirror of auth.users. Populated on first sign-in.';


-- =============================================================================
-- SECTION 4: WORKSPACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    owner_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ DEFAULT NULL,

    CONSTRAINT workspaces_owner_unique UNIQUE (owner_id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at
    ON public.workspaces(deleted_at)
    WHERE deleted_at IS NULL;


-- =============================================================================
-- SECTION 5: WORKSPACE MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            member_role NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT workspace_members_unique_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
    ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
    ON public.workspace_members(workspace_id);


-- =============================================================================
-- SECTION 6: ORGANISATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organisations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    owner_user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_workspace_id UUID        UNIQUE REFERENCES public.workspaces(id) ON DELETE SET NULL,
    is_personal         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organisations_owner_user_id
    ON public.organisations(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_organisations_deleted_at
    ON public.organisations(deleted_at)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_one_personal_per_user
    ON public.organisations(owner_user_id)
    WHERE is_personal = TRUE AND deleted_at IS NULL;


-- =============================================================================
-- SECTION 7: ORGANISATION MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organisation_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID        NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role        member_role NOT NULL DEFAULT 'member',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organisation_members_unique_org_user UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organisation_members_user_id
    ON public.organisation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organisation_members_org_id
    ON public.organisation_members(org_id);


-- =============================================================================
-- SECTION 8: SPACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.spaces (
    id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID             REFERENCES public.workspaces(id) ON DELETE SET NULL,
    org_id              UUID             NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name                TEXT             NOT NULL,
    visibility          space_visibility NOT NULL DEFAULT 'private',
    created_by          UUID             REFERENCES public.users(id) ON DELETE SET NULL,
    source_workspace_id UUID             UNIQUE REFERENCES public.workspaces(id) ON DELETE SET NULL,
    is_default          BOOLEAN          NOT NULL DEFAULT FALSE,
    is_private          BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT spaces_unique_id_org UNIQUE (id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_spaces_org_id
    ON public.spaces(org_id);

CREATE INDEX IF NOT EXISTS idx_spaces_deleted_at
    ON public.spaces(deleted_at)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_one_default_per_org
    ON public.spaces(org_id)
    WHERE is_default = TRUE AND deleted_at IS NULL;


-- =============================================================================
-- SECTION 9: SPACE MEMBERS
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

CREATE INDEX IF NOT EXISTS idx_space_members_org_id
    ON public.space_members(org_id);

CREATE INDEX IF NOT EXISTS idx_space_members_space_id
    ON public.space_members(space_id);

CREATE INDEX IF NOT EXISTS idx_space_members_user_id
    ON public.space_members(user_id);


-- =============================================================================
-- SECTION 10: TASKS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID            REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id              UUID            NOT NULL,
    space_id            UUID            NOT NULL,
    parent_task_id      UUID            REFERENCES public.tasks(id) ON DELETE CASCADE,

    title               TEXT            NOT NULL,
    description         TEXT,
    objective           TEXT,
    success_criteria    TEXT,

    status              task_status     NOT NULL DEFAULT 'backlog',
    priority            task_priority   NOT NULL DEFAULT 'medium',

    type                TEXT            NOT NULL DEFAULT 'task',
    event_type          TEXT,
    location            TEXT,
    is_all_day          BOOLEAN         NOT NULL DEFAULT false,

    start_date          TIMESTAMPTZ,
    due_date            TIMESTAMPTZ,

    created_by          UUID            NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

    google_event_id     TEXT,
    ical_uid            TEXT,
    meet_link           TEXT,

    github_issue_url    TEXT,
    github_issue_number INTEGER,
    github_repo         TEXT,

    guests              TEXT[],
    context             JSONB           NOT NULL DEFAULT '[]'::jsonb,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ     DEFAULT NULL,

    CONSTRAINT task_date_order CHECK (
        due_date IS NULL OR start_date IS NULL OR due_date >= start_date
    ),
    CONSTRAINT task_event_type_check CHECK (
        (type = 'task') OR (type = 'event' AND event_type IS NOT NULL)
    ),
    CONSTRAINT tasks_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.organisations(id)
        ON DELETE CASCADE,
    CONSTRAINT tasks_space_org_fk
        FOREIGN KEY (space_id, org_id)
        REFERENCES public.spaces(id, org_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_tasks_user_google_event UNIQUE (created_by, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id       ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id     ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status             ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority           ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date           ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at         ON public.tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by         ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status_priority
    ON public.tasks(workspace_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_org_space
    ON public.tasks(org_id, space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_status_priority
    ON public.tasks(space_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at
    ON public.tasks(deleted_at)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_ical_uid
    ON public.tasks(ical_uid)
    WHERE ical_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_meet_link
    ON public.tasks(meet_link)
    WHERE meet_link IS NOT NULL;


-- =============================================================================
-- SECTION 11: TASK ASSIGNEES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.task_assignees (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT task_assignees_unique UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id   ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id   ON public.task_assignees(user_id);


-- =============================================================================
-- SECTION 12: TASK DEPENDENCIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_task_id  UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT task_dependencies_unique UNIQUE (task_id, depends_on_task_id),
    CONSTRAINT task_dependencies_no_self_ref CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id
    ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on
    ON public.task_dependencies(depends_on_task_id);


-- =============================================================================
-- SECTION 13: COMMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.comments (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    content             TEXT        NOT NULL,
    parent_comment_id   UUID        REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id             ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id   ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id             ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_created        ON public.comments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at
    ON public.comments(deleted_at)
    WHERE deleted_at IS NULL;


-- =============================================================================
-- SECTION 14: ACTIVITY LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID                REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id          UUID                NOT NULL,
    space_id        UUID,
    user_id         UUID                REFERENCES public.users(id) ON DELETE SET NULL,
    entity_type     log_entity_type     NOT NULL,
    entity_id       UUID                NOT NULL,
    action_type     log_action_type     NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT activity_logs_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.organisations(id)
        ON DELETE CASCADE,
    CONSTRAINT activity_logs_space_org_fk
        FOREIGN KEY (space_id, org_id)
        REFERENCES public.spaces(id, org_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id   ON public.activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity         ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id        ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at     ON public.activity_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_space_created_at
    ON public.activity_logs(org_id, space_id, created_at DESC);


-- =============================================================================
-- SECTION 15: CHANNELS (CHAT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.channels (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID            REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id          UUID            NOT NULL,
    space_id        UUID            NOT NULL,
    name            VARCHAR(50),
    type            VARCHAR(20)     NOT NULL CHECK (type IN ('direct', 'group')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT channels_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.organisations(id)
        ON DELETE CASCADE,
    CONSTRAINT channels_space_org_fk
        FOREIGN KEY (space_id, org_id)
        REFERENCES public.spaces(id, org_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_org_space
    ON public.channels(org_id, space_id);


-- =============================================================================
-- SECTION 16: CHANNEL MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id      UUID            NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            VARCHAR(20)     NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_read_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT channel_members_pkey PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON public.channel_members(channel_id);


-- =============================================================================
-- SECTION 17: MESSAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID            NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    sender_id       UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content         TEXT            NOT NULL,
    reply_to        JSONB           DEFAULT NULL,
    attachments     JSONB           DEFAULT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);


-- =============================================================================
-- SECTION 18: PERSONAL TASKS
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
    google_event_id     TEXT,
    ical_uid            TEXT,
    location            TEXT,
    meet_link           TEXT,
    github_issue_url    TEXT,
    github_issue_number INTEGER,
    github_repo         TEXT,
    guests              TEXT[],
    context             JSONB         NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT personal_task_date_order CHECK (
        due_date IS NULL OR start_date IS NULL OR due_date >= start_date
    ),
    CONSTRAINT uq_personal_tasks_user_google_event UNIQUE (owner_user_id, google_event_id)
);

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
CREATE INDEX IF NOT EXISTS idx_personal_tasks_ical_uid
    ON public.personal_tasks(ical_uid)
    WHERE ical_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personal_tasks_meet_link
    ON public.personal_tasks(meet_link)
    WHERE meet_link IS NOT NULL;


-- =============================================================================
-- SECTION 19: MOTION PAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.motion_pages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID        NOT NULL,
    space_id        UUID        NOT NULL,
    created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    updated_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    parent_id       UUID        REFERENCES public.motion_pages(id) ON DELETE CASCADE,

    title           TEXT        NOT NULL DEFAULT 'Untitled',
    content         JSONB       NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',

    icon            TEXT,
    cover_image     TEXT,
    cover_position  INTEGER     NOT NULL DEFAULT 50,
    small_text      BOOLEAN     NOT NULL DEFAULT FALSE,
    full_width      BOOLEAN     NOT NULL DEFAULT FALSE,

    position        FLOAT8      NOT NULL DEFAULT 0,

    notion_page_id          TEXT,
    notion_last_synced_at   TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    title_search    tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED,

    CONSTRAINT motion_pages_space_org_fk
        FOREIGN KEY (space_id, org_id)
        REFERENCES public.spaces(id, org_id)
        ON DELETE CASCADE,
    CONSTRAINT motion_pages_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.organisations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_motion_pages_org_space
    ON public.motion_pages(org_id, space_id);
CREATE INDEX IF NOT EXISTS idx_motion_pages_parent_id
    ON public.motion_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_motion_pages_active
    ON public.motion_pages(org_id, space_id, position ASC)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_motion_pages_deleted
    ON public.motion_pages(org_id, space_id, deleted_at DESC)
    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_motion_pages_title_search
    ON public.motion_pages USING GIN(title_search);
CREATE INDEX IF NOT EXISTS idx_motion_pages_notion_page_id
    ON public.motion_pages(notion_page_id)
    WHERE notion_page_id IS NOT NULL;


-- =============================================================================
-- SECTION 20: MOTION PAGE SHARES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.motion_page_shares (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID                    NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    share_type      motion_share_type       NOT NULL,
    target_org_id   UUID                    REFERENCES public.organisations(id) ON DELETE CASCADE,
    target_space_id UUID                    REFERENCES public.spaces(id) ON DELETE CASCADE,
    share_token     TEXT                    UNIQUE,
    permission      motion_permission       NOT NULL DEFAULT 'view',
    created_by      UUID                    NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,

    CONSTRAINT motion_page_shares_public_link_check CHECK (
        (share_type = 'public_link' AND share_token IS NOT NULL AND target_org_id IS NULL AND target_space_id IS NULL)
        OR
        (share_type = 'space' AND share_token IS NULL AND target_org_id IS NOT NULL AND target_space_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_motion_page_shares_unique_space
    ON public.motion_page_shares(page_id, target_org_id, target_space_id)
    WHERE share_type = 'space';
CREATE INDEX IF NOT EXISTS idx_motion_page_shares_token
    ON public.motion_page_shares(share_token)
    WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_motion_page_shares_target_space
    ON public.motion_page_shares(target_org_id, target_space_id)
    WHERE share_type = 'space';
CREATE INDEX IF NOT EXISTS idx_motion_page_shares_page_id
    ON public.motion_page_shares(page_id);


-- =============================================================================
-- SECTION 21: MOTION ANALYTICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.motion_page_updates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID        NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    action_type     TEXT        NOT NULL,
    description     TEXT,
    before_title    TEXT,
    before_content  JSONB,
    deleted_content JSONB,
    added_content   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motion_page_updates_page
    ON public.motion_page_updates(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_motion_page_updates_session
    ON public.motion_page_updates(page_id, user_id, action_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_motion_page_updates_created
    ON public.motion_page_updates(created_at);


CREATE TABLE IF NOT EXISTS public.motion_page_views (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID        NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motion_page_views_page_date
    ON public.motion_page_views(page_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.motion_page_view_permissions (
    page_id             UUID        NOT NULL REFERENCES public.motion_pages(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    allow_view_history  BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (page_id, user_id)
);


-- =============================================================================
-- SECTION 22: USER INTEGRATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_integrations (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID                NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider                TEXT                NOT NULL,
    access_token            TEXT,
    refresh_token           TEXT,
    token_expiry            TIMESTAMPTZ,
    calendar_id             TEXT                NOT NULL DEFAULT 'primary',
    watch_status            gcal_watch_status   DEFAULT 'pending',
    watch_channel_id        TEXT,
    watch_resource_id       TEXT,
    watch_expires_at        TIMESTAMPTZ,
    gcal_sync_token         TEXT,
    last_sync_at            TIMESTAMPTZ,
    sync_in_progress        BOOLEAN             DEFAULT FALSE,
    last_sync_error         TEXT,
    last_successful_sync_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT user_integrations_unique_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id
    ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider
    ON public.user_integrations(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_channel_id
    ON public.user_integrations(watch_channel_id)
    WHERE watch_channel_id IS NOT NULL;


-- =============================================================================
-- SECTION 23: GCAL WEBHOOK RECEIPTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gcal_webhook_receipts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      TEXT        NOT NULL,
    resource_id     TEXT        NOT NULL,
    message_number  BIGINT      NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_gcal_webhook_receipt UNIQUE (channel_id, resource_id, message_number)
);

CREATE INDEX IF NOT EXISTS idx_gcal_webhook_receipts_channel_message
    ON public.gcal_webhook_receipts(channel_id, message_number);


-- =============================================================================
-- SECTION 24: MEETING RECORDINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.meeting_recordings (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    meeting_id              UUID        REFERENCES public.tasks(id) ON DELETE CASCADE,
    audio_s3_key            TEXT        NOT NULL,
    audio_duration_seconds  INT,
    sarvam_job_id           TEXT,
    transcription_status    TEXT        NOT NULL DEFAULT 'pending',
    transcript_text         TEXT,
    transcript_diarized     JSONB,
    language_detected       TEXT,
    stt_provider            TEXT        NOT NULL DEFAULT 'elevenlabs',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own recordings" ON public.meeting_recordings
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_recordings_user_id
    ON public.meeting_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting_id
    ON public.meeting_recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_created_at_desc
    ON public.meeting_recordings(created_at DESC);


-- =============================================================================
-- SECTION 25: NOTIFICATION SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    user_id                     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    notify_task_assigned        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_message              BOOLEAN NOT NULL DEFAULT TRUE,
    notify_motion_shared        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_status_changed       BOOLEAN NOT NULL DEFAULT TRUE,
    notify_membership_updated   BOOLEAN NOT NULL DEFAULT TRUE,
    notify_comment_mention      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id        UUID         REFERENCES public.organisations(id) ON DELETE CASCADE,
    space_id      UUID         REFERENCES public.spaces(id) ON DELETE CASCADE,
    recipient_id  UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id     UUID         REFERENCES public.users(id) ON DELETE SET NULL,
    event_type    TEXT         NOT NULL,
    entity_type   TEXT         NOT NULL,
    entity_id     UUID         NOT NULL,
    payload       JSONB        NOT NULL,
    read_at       TIMESTAMPTZ  DEFAULT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON public.notifications(recipient_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at
    ON public.notifications(recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID,
    org_id        UUID,
    space_id      UUID,
    sender_id     UUID,
    event_type    TEXT         NOT NULL,
    entity_type   TEXT         NOT NULL,
    entity_id     UUID         NOT NULL,
    payload       JSONB        NOT NULL,
    status        TEXT         NOT NULL DEFAULT 'pending',
    attempts      INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status
    ON public.notification_outbox(status);


-- =============================================================================
-- SECTION 26: USER APP PREFERENCES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_app_preferences (
    user_id                 UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    stt_provider            TEXT NOT NULL DEFAULT 'elevenlabs',
    delete_slots_on_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_app_preferences_user_id ON public.user_app_preferences(user_id);


-- =============================================================================
-- SECTION 27: RATE LIMITS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key         VARCHAR(255) PRIMARY KEY,
    points      INTEGER NOT NULL DEFAULT 1,
    expire_at   TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expire_at ON public.rate_limits(expire_at);


-- =============================================================================
-- SECTION 28: PERSONAL CHECKLISTS
-- =============================================================================

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


-- =============================================================================
-- SECTION 29: TASK SLOTS
-- =============================================================================

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


-- =============================================================================
-- SECTION 30: USER SESSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    browser_id  TEXT        NOT NULL,
    user_agent  TEXT,
    platform    TEXT,
    login_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT user_sessions_user_browser_unique UNIQUE (user_id, browser_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);


-- =============================================================================
-- SECTION 31: ROW LEVEL SECURITY (CHAT)
-- =============================================================================

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view channels they belong to"
    ON public.channels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channel_members cm
            WHERE cm.channel_id = id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view members of their channels"
    ON public.channel_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channel_members cm_viewer
            WHERE cm_viewer.channel_id = channel_id
            AND cm_viewer.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view messages of their channels"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channel_members cm
            WHERE cm.channel_id = channel_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages to their channels"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.channel_members cm
            WHERE cm.channel_id = channel_id
            AND cm.user_id = auth.uid()
        )
    );


-- =============================================================================
-- SECTION 32: FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Handle new user signup: create profile, preferences, personal org + space
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_org_id UUID;
    v_space_id UUID;
    v_full_name TEXT;
    v_org_name TEXT;
BEGIN
    -- 1. Insert into public.users with OAuth avatar URL if available
    INSERT INTO public.users (id, email, name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1)
        ),
        COALESCE(
            new.raw_user_meta_data->>'avatar_url',
            new.raw_user_meta_data->>'picture'
        )
    )
    ON CONFLICT (id) DO UPDATE
    SET avatar_url = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url);

    -- 2. Create default notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Create default app preferences
    INSERT INTO public.user_app_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- 4. Derive personal organisation name
    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_org_name := v_full_name || '''s space';

    -- 5. Create personal organisation
    INSERT INTO public.organisations (name, owner_user_id, is_personal)
    VALUES (v_org_name, new.id, TRUE)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_org_id;

    IF v_org_id IS NOT NULL THEN
        -- 6. Create organisation membership as owner
        INSERT INTO public.organisation_members (org_id, user_id, role)
        VALUES (v_org_id, new.id, 'owner')
        ON CONFLICT DO NOTHING;

        -- 7. Create Private space
        INSERT INTO public.spaces (org_id, name, visibility, created_by, is_default, is_private)
        VALUES (v_org_id, 'Private', 'private', new.id, TRUE, TRUE)
        RETURNING id INTO v_space_id;

        -- 8. Create space membership as admin
        INSERT INTO public.space_members (org_id, space_id, user_id, role)
        VALUES (v_org_id, v_space_id, new.id, 'admin')
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Handle user metadata updates (avatar_url, name sync)
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS trigger AS $$
BEGIN
    UPDATE public.users
    SET
        name = COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', name),
        avatar_url = COALESCE(
            new.raw_user_meta_data->>'avatar_url',
            new.raw_user_meta_data->>'picture'
        )
    WHERE id = new.id;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update channel.last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_channel_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$;

-- Auto-insert workspace owner as 'owner' member
CREATE OR REPLACE FUNCTION public.add_workspace_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');
    RETURN NEW;
END;
$$;

-- Ensure workspace has corresponding organisation
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
        name, owner_user_id, source_workspace_id, created_at, deleted_at
    )
    VALUES (
        v_workspace.name, v_workspace.owner_id, v_workspace.id,
        v_workspace.created_at, v_workspace.deleted_at
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
        s.created_at ASC, s.id ASC
    LIMIT 1;

    IF v_space_id IS NULL THEN
        INSERT INTO public.spaces (
            workspace_id, org_id, name, visibility, created_by,
            source_workspace_id, created_at, deleted_at
        )
        VALUES (
            v_workspace.id, v_org_id, 'General', 'private',
            v_workspace.owner_id, v_workspace.id,
            v_workspace.created_at, v_workspace.deleted_at
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
                    SELECT 1 FROM public.spaces sx
                    WHERE sx.source_workspace_id = v_workspace.id AND sx.id <> s.id
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


-- Sync workspace insert to organisation
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
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    INSERT INTO public.space_members (org_id, space_id, user_id, role, created_at)
    VALUES (v_org_id, v_space_id, NEW.owner_id, 'owner', NEW.created_at)
    ON CONFLICT (space_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

-- Sync workspace member changes to org/space
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
        WHERE org_id = v_org_id AND space_id = v_space_id AND user_id = OLD.user_id;

        DELETE FROM public.organisation_members
        WHERE org_id = v_org_id AND user_id = OLD.user_id;

        RETURN OLD;
    END IF;

    INSERT INTO public.organisation_members (org_id, user_id, role, created_at)
    VALUES (v_org_id, NEW.user_id, NEW.role, NEW.created_at)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    INSERT INTO public.space_members (org_id, space_id, user_id, role, created_at)
    VALUES (v_org_id, v_space_id, NEW.user_id, NEW.role, NEW.created_at)
    ON CONFLICT (space_id, user_id)
    DO UPDATE SET org_id = EXCLUDED.org_id, role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

-- Fill task org/space from workspace
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


-- Fill channel org/space from workspace
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

-- Fill activity_logs org/space from workspace
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

-- Enforce task assignee is space member
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

-- Enforce task dependency same space
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


-- =============================================================================
-- SECTION 33: TRIGGERS
-- =============================================================================

-- updated_at triggers
CREATE TRIGGER tasks_set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organisations_set_updated_at
    BEFORE UPDATE ON public.organisations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER spaces_set_updated_at
    BEFORE UPDATE ON public.spaces
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER personal_tasks_set_updated_at
    BEFORE UPDATE ON public.personal_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER motion_pages_set_updated_at
    BEFORE UPDATE ON public.motion_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_integrations_set_updated_at
    BEFORE UPDATE ON public.user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Auth triggers
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_update_user();

-- Workspace triggers
CREATE TRIGGER workspaces_add_owner_member
    AFTER INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.add_workspace_owner_as_member();

CREATE TRIGGER workspaces_sync_organisation
    AFTER INSERT OR UPDATE OF name, owner_id, deleted_at ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_workspace_insert_to_organisation();

CREATE TRIGGER workspace_members_sync_org_space
    AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_workspace_member_to_org_space();

-- Org/space fill triggers
CREATE TRIGGER tasks_fill_org_space
    BEFORE INSERT OR UPDATE OF workspace_id, org_id, space_id, parent_task_id ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_task_org_space_from_workspace();

CREATE TRIGGER channels_fill_org_space
    BEFORE INSERT OR UPDATE OF workspace_id, org_id, space_id ON public.channels
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_channel_org_space_from_workspace();

CREATE TRIGGER activity_logs_fill_org_space
    BEFORE INSERT OR UPDATE OF workspace_id, org_id, space_id ON public.activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_activity_org_space_from_workspace();

-- Safety triggers
CREATE TRIGGER task_assignees_enforce_space_member
    BEFORE INSERT OR UPDATE OF task_id, user_id ON public.task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_task_assignee_space_member();

CREATE TRIGGER task_dependencies_enforce_same_space
    BEFORE INSERT OR UPDATE OF task_id, depends_on_task_id ON public.task_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_task_dependency_same_space();

-- Chat triggers
CREATE TRIGGER trg_update_channel_last_message_at
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_channel_last_message_at();


-- =============================================================================
-- END OF CONSOLIDATED MIGRATION
-- =============================================================================
