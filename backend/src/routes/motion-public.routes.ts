import { Router } from 'express';
import { getPublicPage, getPublicPageById } from '../controllers/motion-page.controller';

const router = Router();

// No auth middleware — public endpoints for shared page links

// New page-ID-based public link — must be BEFORE the token route to avoid
// the :token wildcard matching the literal "page" segment.
router.get('/notes/public/page/:pageId', getPublicPageById);

// Legacy token-based public link (kept for backward compatibility)
router.get('/notes/public/:token', getPublicPage);

export default router;
