import { Router } from 'express';
import { createMotion, getMotion } from '../controllers/motion.controller';

const router = Router();

// Create a new Motion from a recording
router.post('/', createMotion);

// Get a Motion by its public share token
router.get('/:token', getMotion);

export default router;
