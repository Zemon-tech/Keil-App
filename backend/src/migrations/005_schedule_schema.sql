-- Migration: 005_schedule_schema.sql
-- NOTE: 004_chat_schema.sql is already taken by the Chat module. This is 005.

CREATE TABLE task_schedules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id         UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- One contiguous block per user per task
  UNIQUE(task_id, user_id),

  -- Block must have positive duration (DB-level safety net)
  CONSTRAINT task_schedules_valid_range CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_task_schedules_workspace_id ON task_schedules(workspace_id);
CREATE INDEX idx_task_schedules_user_id      ON task_schedules(user_id);
CREATE INDEX idx_task_schedules_task_id      ON task_schedules(task_id);
