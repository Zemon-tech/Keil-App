import pool from '../config/pg';
import { io } from '../socket';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('task-overdue-worker');

/**
 * Background worker to automatically move overdue tasks to backlog.
 * 
 * Rules:
 * - Status is "todo"
 * - Due date and time are set
 * - Due date and time have passed
 * - Only "task" type (not events)
 * - Task is moved to "backlog"
 */
export class TaskOverdueWorkerService {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

    public start() {
        if (this.intervalId) return;

        log.info("Task overdue worker started");
        this.intervalId = setInterval(() => this.checkOverdueTasks(), this.CHECK_INTERVAL);
        
        // Also run immediately on start (with a slight delay to ensure DB/Socket are ready)
        setTimeout(() => this.checkOverdueTasks(), 5000);
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            log.info("Task overdue worker stopped");
        }
    }

    private async checkOverdueTasks() {
        try {
            // 1. Handle Workspace Tasks (Tenancy model)
            // Only update "todo" tasks that have a due_date and it's in the past.
            // We use type = 'task' to avoid moving events to backlog.
            const workspaceResult = await pool.query(`
                UPDATE public.tasks
                SET status = 'backlog', updated_at = NOW()
                WHERE status = 'todo'
                  AND due_date IS NOT NULL
                  AND due_date < NOW()
                  AND updated_at < due_date
                  AND (type = 'task' OR type IS NULL)
                RETURNING id, org_id, space_id, title
            `);

            if (workspaceResult.rows.length > 0) {
                log.info({ count: workspaceResult.rows.length, type: 'workspace' }, "Moved tasks to backlog");
                
                // Broadcast update via Socket.io
                if (io) {
                    workspaceResult.rows.forEach(task => {
                        io.emit('task_overdue_moved', {
                            id: task.id,
                            status: 'backlog',
                            org_id: task.org_id,
                            space_id: task.space_id
                        });
                    });
                }
            }

            // 2. Handle Personal Tasks
            const personalResult = await pool.query(`
                UPDATE public.personal_tasks
                SET status = 'backlog', updated_at = NOW()
                WHERE status = 'todo'
                  AND due_date IS NOT NULL
                  AND due_date < NOW()
                  AND updated_at < due_date
                RETURNING id, owner_user_id, title
            `);

            if (personalResult.rows.length > 0) {
                log.info({ count: personalResult.rows.length, type: 'personal' }, "Moved tasks to backlog");
                
                if (io) {
                    personalResult.rows.forEach(task => {
                        // For personal tasks, we only notify the owner
                        io.to(`user:${task.owner_user_id}`).emit('task_overdue_moved', {
                            id: task.id,
                            status: 'backlog',
                            owner_user_id: task.owner_user_id,
                            is_personal: true
                        });
                    });
                }
            }
        } catch (error) {
            log.error({ err: error }, "Error checking overdue tasks");
        }
    }
}

export const taskOverdueWorkerService = new TaskOverdueWorkerService();
