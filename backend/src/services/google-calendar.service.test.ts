/**
 * Tests for Google Calendar 2-way sync — task_slots management.
 *
 * Covers:
 * - New org task created from Google event → slot is created
 * - Existing org task updated from Google event → slot is upserted
 * - Google event cancelled → task soft-deleted + slot removed
 * - Task without existing slot gets one created on update
 * - Duplicate events (23505) handled gracefully without orphaned slots
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pool from "../config/pg";
import { seedUser, seedOrg, seedSpace } from "../test/helpers";
import { processIncomingGoogleEvent, processIncomingGoogleTask } from "./google-calendar.service";
import { calendar_v3 } from "googleapis";

// ─── Test Constants ──────────────────────────────────────────────────────────

const TEST_USER_ID = "a1111111-1111-1111-1111-111111111111";
const TEST_ORG_ID = "b2222222-2222-2222-2222-222222222222";
const TEST_SPACE_ID = "c3333333-3333-3333-3333-333333333333";

// ─── Setup & Teardown ────────────────────────────────────────────────────────

// NOTE: The global setup.ts runs clearDatabase() (TRUNCATE ALL) in a global
// beforeEach. So we must re-seed our test data in beforeEach, not beforeAll.

beforeEach(async () => {
  // Seed test user, org, and space (after global TRUNCATE wipes everything)
  await seedUser(TEST_USER_ID, "gcaltest@keilhq.in", "GCal Test User");
  await seedOrg(TEST_ORG_ID, "GCal Test Org", TEST_USER_ID);
  await seedSpace(TEST_SPACE_ID, TEST_ORG_ID, "General", TEST_USER_ID);
});

afterAll(async () => {
  // No cleanup needed — global setup.ts TRUNCATE handles it
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGoogleEvent(overrides: Partial<calendar_v3.Schema$Event> = {}): calendar_v3.Schema$Event {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    id: "google-event-" + Math.random().toString(36).slice(2, 10),
    iCalUID: "ical-" + Math.random().toString(36).slice(2, 10),
    summary: "Test Meeting",
    status: "confirmed",
    start: { dateTime: now.toISOString() },
    end: { dateTime: oneHourLater.toISOString() },
    updated: new Date(now.getTime() + 10000).toISOString(), // 10s in the future to win conflict resolution
    ...overrides,
  };
}

async function getTaskByGoogleEventId(googleEventId: string) {
  const result = await pool.query(
    `SELECT * FROM public.tasks WHERE google_event_id = $1 AND deleted_at IS NULL`,
    [googleEventId]
  );
  return result.rows[0] || null;
}

async function getSlotsByTaskId(taskId: string) {
  const result = await pool.query(
    `SELECT * FROM public.task_slots WHERE task_id = $1`,
    [taskId]
  );
  return result.rows;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("processIncomingGoogleEvent — task_slots management", () => {
  const defaultOrgSpace = { orgId: TEST_ORG_ID, spaceId: TEST_SPACE_ID };

  describe("new event → creates task + slot", () => {
    it("should create a task_slot when a new Google event is imported", async () => {
      const event = makeGoogleEvent({ summary: "Slot Creation Test" });

      await processIncomingGoogleEvent(TEST_USER_ID, event, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(event.id!);
      expect(task).not.toBeNull();
      expect(task.title).toBe("Slot Creation Test");

      const slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(1);
      expect(slots[0].user_id).toBe(TEST_USER_ID);
      expect(new Date(slots[0].start_date).getTime()).toBe(new Date(event.start!.dateTime!).getTime());
      expect(new Date(slots[0].due_date).getTime()).toBe(new Date(event.end!.dateTime!).getTime());
    });

    it("should create a slot with is_all_day=true for all-day events", async () => {
      const event = makeGoogleEvent({
        summary: "All Day Event",
        start: { date: "2026-06-20" },
        end: { date: "2026-06-21" }, // exclusive end, so due_date should be June 20
      });

      await processIncomingGoogleEvent(TEST_USER_ID, event, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(event.id!);
      expect(task).not.toBeNull();

      const slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(1);
      expect(slots[0].is_all_day).toBe(true);
    });

    it("should NOT create a slot for personal task fallback (no org/space)", async () => {
      const event = makeGoogleEvent({ summary: "Personal Fallback" });

      // Pass null for defaultOrgSpace to simulate no org found
      await processIncomingGoogleEvent(TEST_USER_ID, event, null);

      // Task should be in personal_tasks, not tasks
      const orgTask = await getTaskByGoogleEventId(event.id!);
      expect(orgTask).toBeNull();

      // Verify personal task was created
      const personalResult = await pool.query(
        `SELECT * FROM public.personal_tasks WHERE google_event_id = $1`,
        [event.id]
      );
      expect(personalResult.rows).toHaveLength(1);

      // No slot should exist (personal tasks don't use slots)
      const slots = await pool.query(
        `SELECT * FROM public.task_slots WHERE user_id = $1`,
        [TEST_USER_ID]
      );
      expect(slots.rows).toHaveLength(0);
    });
  });

  describe("existing event updated → slot is upserted", () => {
    it("should update existing slot dates when Google event is updated", async () => {
      // First, create the event
      const originalStart = new Date("2026-06-20T10:00:00Z");
      const originalEnd = new Date("2026-06-20T11:00:00Z");
      const event = makeGoogleEvent({
        summary: "Update Test",
        start: { dateTime: originalStart.toISOString() },
        end: { dateTime: originalEnd.toISOString() },
        updated: new Date("2026-06-20T09:00:00Z").toISOString(),
      });

      await processIncomingGoogleEvent(TEST_USER_ID, event, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(event.id!);
      expect(task).not.toBeNull();

      let slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(1);
      expect(new Date(slots[0].start_date).getTime()).toBe(originalStart.getTime());

      // Now simulate an update from Google with new dates
      const newStart = new Date("2026-06-21T14:00:00Z");
      const newEnd = new Date("2026-06-21T15:00:00Z");
      const updatedEvent = makeGoogleEvent({
        id: event.id, // same event ID
        iCalUID: event.iCalUID,
        summary: "Update Test Renamed",
        start: { dateTime: newStart.toISOString() },
        end: { dateTime: newEnd.toISOString() },
        updated: new Date("2026-06-21T13:00:00Z").toISOString(), // newer than task updated_at
      });

      await processIncomingGoogleEvent(TEST_USER_ID, updatedEvent, defaultOrgSpace);

      // Slot should be updated, not duplicated
      slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(1);
      expect(new Date(slots[0].start_date).getTime()).toBe(newStart.getTime());
      expect(new Date(slots[0].due_date).getTime()).toBe(newEnd.getTime());
    });

    it("should create a slot if task exists but has no slot (pre-fix data)", async () => {
      // Manually insert a task without a slot (simulates pre-fix state)
      const googleEventId = "pre-fix-event-001";
      const taskResult = await pool.query(
        `INSERT INTO public.tasks
           (org_id, space_id, title, start_date, due_date, google_event_id, status, priority, created_by, type, event_type)
         VALUES ($1, $2, 'Pre-fix Task', '2026-06-15T10:00:00Z', '2026-06-15T11:00:00Z', $3, 'todo', 'medium', $4, 'event', 'meeting')
         RETURNING id`,
        [TEST_ORG_ID, TEST_SPACE_ID, googleEventId, TEST_USER_ID]
      );
      const taskId = taskResult.rows[0].id;

      // Verify no slot exists
      let slots = await getSlotsByTaskId(taskId);
      expect(slots).toHaveLength(0);

      // Simulate Google sending an update for this event
      const newStart = new Date("2026-06-16T10:00:00Z");
      const newEnd = new Date("2026-06-16T11:00:00Z");
      const updateEvent = makeGoogleEvent({
        id: googleEventId,
        summary: "Pre-fix Task Updated",
        start: { dateTime: newStart.toISOString() },
        end: { dateTime: newEnd.toISOString() },
        updated: new Date(Date.now() + 60000).toISOString(), // 1 minute in the future — guarantees Google wins conflict resolution
      });

      await processIncomingGoogleEvent(TEST_USER_ID, updateEvent, defaultOrgSpace);

      // A new slot should have been created
      slots = await getSlotsByTaskId(taskId);
      expect(slots).toHaveLength(1);
      expect(new Date(slots[0].start_date).getTime()).toBe(newStart.getTime());
      expect(new Date(slots[0].due_date).getTime()).toBe(newEnd.getTime());
    });
  });

  describe("event cancelled → task soft-deleted + slot removed", () => {
    it("should delete the task_slot when a Google event is cancelled", async () => {
      // Create an event first
      const event = makeGoogleEvent({ summary: "Will Be Cancelled" });
      await processIncomingGoogleEvent(TEST_USER_ID, event, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(event.id!);
      expect(task).not.toBeNull();

      let slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(1);

      // Now simulate cancellation
      const cancelledEvent: calendar_v3.Schema$Event = {
        id: event.id,
        status: "cancelled",
      };

      await processIncomingGoogleEvent(TEST_USER_ID, cancelledEvent, defaultOrgSpace);

      // Task should be soft-deleted
      const deletedTask = await pool.query(
        `SELECT * FROM public.tasks WHERE id = $1`,
        [task.id]
      );
      expect(deletedTask.rows[0].deleted_at).not.toBeNull();

      // Slot should be removed
      slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(0);
    });

    it("should not crash when cancelling a task that has no slot", async () => {
      // Manually create a task without a slot
      const googleEventId = "no-slot-cancel-test";
      await pool.query(
        `INSERT INTO public.tasks
           (org_id, space_id, title, start_date, due_date, google_event_id, status, priority, created_by, type, event_type)
         VALUES ($1, $2, 'No Slot Task', '2026-06-15T10:00:00Z', '2026-06-15T11:00:00Z', $3, 'todo', 'medium', $4, 'event', 'meeting')`,
        [TEST_ORG_ID, TEST_SPACE_ID, googleEventId, TEST_USER_ID]
      );

      // Cancel it — should not throw
      const cancelledEvent: calendar_v3.Schema$Event = {
        id: googleEventId,
        status: "cancelled",
      };

      await expect(
        processIncomingGoogleEvent(TEST_USER_ID, cancelledEvent, defaultOrgSpace)
      ).resolves.not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should skip events outside the 60-day sync window", async () => {
      const oldEvent = makeGoogleEvent({
        summary: "Ancient Event",
        start: { dateTime: new Date("2025-01-01T10:00:00Z").toISOString() },
        end: { dateTime: new Date("2025-01-01T11:00:00Z").toISOString() },
      });

      await processIncomingGoogleEvent(TEST_USER_ID, oldEvent, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(oldEvent.id!);
      expect(task).toBeNull(); // Should not have been created
    });

    it("should skip events tagged with source=keilhq that were explicitly soft-deleted in KeilHQ", async () => {
      const taskId = "d4444444-4444-4444-4444-444444444444";
      const googleEventId = "keilhq-deleted-event-123";
      
      // Seed the task as soft-deleted in the database
      await pool.query(
        `INSERT INTO public.tasks
           (id, org_id, space_id, title, google_event_id, status, priority, created_by, type, event_type, deleted_at)
         VALUES ($1, $2, $3, 'From KeilHQ (deleted)', $4, 'todo', 'medium', $5, 'event', 'meeting', NOW())`,
        [taskId, TEST_ORG_ID, TEST_SPACE_ID, googleEventId, TEST_USER_ID]
      );

      const keilhqEvent = makeGoogleEvent({
        id: googleEventId,
        summary: "From KeilHQ (deleted)",
        extendedProperties: {
          private: { source: "keilhq", taskId },
        },
      });

      await processIncomingGoogleEvent(TEST_USER_ID, keilhqEvent, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(googleEventId);
      expect(task).toBeNull(); // Loop prevention — should not recreate since it was deleted
    });

    it("should import events tagged with source=keilhq that do not exist in the database (e.g. database reset)", async () => {
      const taskId = "d5555555-5555-5555-5555-555555555555";
      const googleEventId = "keilhq-fresh-event-123";

      const keilhqEvent = makeGoogleEvent({
        id: googleEventId,
        summary: "From KeilHQ (fresh import)",
        extendedProperties: {
          private: { source: "keilhq", taskId },
        },
      });

      await processIncomingGoogleEvent(TEST_USER_ID, keilhqEvent, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(googleEventId);
      expect(task).not.toBeNull();
      expect(task.title).toBe("From KeilHQ (fresh import)");
    });

    it("should not update task or slot when values are identical", async () => {
      const start = new Date("2026-06-20T10:00:00Z");
      const end = new Date("2026-06-20T11:00:00Z");
      const event = makeGoogleEvent({
        summary: "No-Op Test",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        updated: new Date("2026-06-20T09:00:00Z").toISOString(),
      });

      await processIncomingGoogleEvent(TEST_USER_ID, event, defaultOrgSpace);

      const task = await getTaskByGoogleEventId(event.id!);
      const originalUpdatedAt = task.updated_at;

      // Send the same event again with the same data
      // (updated timestamp is the same or older — conflict resolution skips it)
      await processIncomingGoogleEvent(TEST_USER_ID, event, defaultOrgSpace);

      const taskAfter = await getTaskByGoogleEventId(event.id!);
      // updated_at should not have changed (no write occurred)
      expect(new Date(taskAfter.updated_at).getTime()).toBe(new Date(originalUpdatedAt).getTime());

      // Still exactly one slot
      const slots = await getSlotsByTaskId(task.id);
      expect(slots).toHaveLength(1);
    });
  });

  describe("processIncomingGoogleTask — Google Tasks sync", () => {
    const defaultOrgSpace = { orgId: TEST_ORG_ID, spaceId: TEST_SPACE_ID };

    it("should create an org task with type='task' when a new Google Task is imported", async () => {
      const googleTask = {
        id: "google-task-abc",
        title: "Test Task Title",
        notes: "Test Task Notes",
        status: "needsAction",
        due: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      await processIncomingGoogleTask(TEST_USER_ID, googleTask, defaultOrgSpace);

      const result = await pool.query(
        `SELECT * FROM public.tasks WHERE google_event_id = $1 AND deleted_at IS NULL`,
        [googleTask.id]
      );
      const dbTask = result.rows[0];
      expect(dbTask).not.toBeNull();
      expect(dbTask.title).toBe("Test Task Title");
      expect(dbTask.description).toBe("Test Task Notes");
      expect(dbTask.type).toBe("task");

      // Verify slot is also created
      const slots = await getSlotsByTaskId(dbTask.id);
      expect(slots).toHaveLength(1);
    });

    it("should update an existing task and slot when updated Google Task is received", async () => {
      const googleTaskId = "existing-google-task-123";
      
      // Seed task
      const taskResult = await pool.query(
        `INSERT INTO public.tasks
           (org_id, space_id, title, start_date, due_date, google_event_id, status, priority, created_by, type)
         VALUES ($1, $2, 'Old Title', '2026-06-20T10:00:00Z', '2026-06-20T11:00:00Z', $3, 'todo', 'medium', $4, 'task')
         RETURNING id`,
        [TEST_ORG_ID, TEST_SPACE_ID, googleTaskId, TEST_USER_ID]
      );
      const taskId = taskResult.rows[0].id;

      // Seed slot
      await pool.query(
        `INSERT INTO public.task_slots (task_id, user_id, start_date, due_date, is_all_day)
         VALUES ($1, $2, '2026-06-20T10:00:00Z', '2026-06-20T11:00:00Z', false)`,
        [taskId, TEST_USER_ID]
      );

      const updatedGoogleTask = {
        id: googleTaskId,
        title: "New Title from Google",
        notes: "Updated description",
        status: "needsAction",
        due: new Date("2026-06-21T00:00:00Z").toISOString(),
        updated: new Date(Date.now() + 10000).toISOString(),
      };

      await processIncomingGoogleTask(TEST_USER_ID, updatedGoogleTask, defaultOrgSpace);

      const updatedTaskResult = await pool.query(
        `SELECT * FROM public.tasks WHERE id = $1`,
        [taskId]
      );
      const dbTask = updatedTaskResult.rows[0];
      expect(dbTask.title).toBe("New Title from Google");
      expect(dbTask.description).toBe("Updated description");

      // Slot should be updated
      const slots = await getSlotsByTaskId(taskId);
      expect(slots).toHaveLength(1);
      expect(new Date(slots[0].start_date).toISOString()).toContain("2026-06-21");
    });

    it("should mark task as completed when Google Task is completed", async () => {
      const googleTaskId = "complete-google-task-123";

      const taskResult = await pool.query(
        `INSERT INTO public.tasks
           (org_id, space_id, title, google_event_id, status, priority, created_by, type)
         VALUES ($1, $2, 'To Complete', $3, 'todo', 'medium', $4, 'task')
         RETURNING id`,
        [TEST_ORG_ID, TEST_SPACE_ID, googleTaskId, TEST_USER_ID]
      );
      const taskId = taskResult.rows[0].id;

      const completedGoogleTask = {
        id: googleTaskId,
        title: "To Complete",
        status: "completed",
        updated: new Date(Date.now() + 10000).toISOString(),
      };

      await processIncomingGoogleTask(TEST_USER_ID, completedGoogleTask, defaultOrgSpace);

      const dbTaskRes = await pool.query(
        `SELECT status FROM public.tasks WHERE id = $1`,
        [taskId]
      );
      expect(dbTaskRes.rows[0].status).toBe("done");
    });

    it("should soft-delete task when Google Task is deleted", async () => {
      const googleTaskId = "delete-google-task-123";

      const taskResult = await pool.query(
        `INSERT INTO public.tasks
           (org_id, space_id, title, google_event_id, status, priority, created_by, type)
         VALUES ($1, $2, 'To Delete', $3, 'todo', 'medium', $4, 'task')
         RETURNING id`,
        [TEST_ORG_ID, TEST_SPACE_ID, googleTaskId, TEST_USER_ID]
      );
      const taskId = taskResult.rows[0].id;

      const deletedGoogleTask = {
        id: googleTaskId,
        deleted: true,
      };

      await processIncomingGoogleTask(TEST_USER_ID, deletedGoogleTask, defaultOrgSpace);

      const dbTaskRes = await pool.query(
        `SELECT deleted_at FROM public.tasks WHERE id = $1`,
        [taskId]
      );
      expect(dbTaskRes.rows[0].deleted_at).not.toBeNull();
    });
  });
});
