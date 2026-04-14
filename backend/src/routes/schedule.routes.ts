import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import * as scheduleController from '../controllers/schedule.controller';

const router = Router();

// Apply protect middleware wrapper to ensuring req.user and req.workspaceId are attached
router.use(protect);

router.get('/calendar', scheduleController.getCalendarTasks);
router.get('/unscheduled', scheduleController.getUnscheduledTasks);
router.put('/tasks/:taskId/timeblock', scheduleController.updateTaskTimeblock);
router.delete('/tasks/:taskId/timeblock', scheduleController.deleteTaskTimeblock);
router.get('/gantt', scheduleController.getGanttTasks);
router.patch('/tasks/:id/deadline', scheduleController.updateTaskDeadline);

export default router;
