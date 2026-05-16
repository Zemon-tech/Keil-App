import { Router } from 'express';
import { getPublicPage } from '../controllers/motion-page.controller';

const router = Router();

// No auth middleware — public endpoint for shared page links
router.get('/notes/public/:token', getPublicPage);

export default router;
