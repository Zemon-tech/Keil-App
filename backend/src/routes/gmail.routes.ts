import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { getInbox, getMessageDetails } from '../controllers/gmail.controller';

const router = Router();

router.get('/inbox', protect, getInbox);
router.get('/messages/:id', protect, getMessageDetails);

export default router;
