import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { requireOrgMember, requireSpaceMember } from '../middlewares/org-context.middleware';
import { requireSpaceRole } from '../middlewares/rbac.middleware';
import { pageCreationRateLimiter, pageUpdateRateLimiter, aiRateLimiter, aiDailyRateLimiter } from '../middlewares/rate-limiter.middleware';
import {
  listPages,
  listTrash,
  getPage,
  createPage,
  updatePage,
  softDeletePage,
  restorePage,
  hardDeletePage,
  listShares,
  createShare,
  revokeShare,
  updateShare,
  listSharedToSpace,
} from '../controllers/motion-page.controller';

const router = Router({ mergeParams: true });

// All routes require authentication + org membership + space membership
router.use(protect, requireOrgMember, requireSpaceMember);

// ── Page CRUD ─────────────────────────────────────────────────────────────────
router.get('/', requireSpaceRole("admin", "manager", "member"), listPages);
router.post('/', pageCreationRateLimiter, requireSpaceRole("admin", "manager"), createPage);
router.get('/trash', requireSpaceRole("admin", "manager", "member"), listTrash);
router.get('/shared', requireSpaceRole("admin", "manager", "member"), listSharedToSpace);
router.get('/:id', requireSpaceRole("admin", "manager", "member"), getPage);
router.patch('/:id', pageUpdateRateLimiter, requireSpaceRole("admin", "manager", "member"), updatePage);
router.delete('/:id', requireSpaceRole("admin", "manager"), softDeletePage);
router.patch('/:id/restore', requireSpaceRole("admin", "manager"), restorePage);
router.delete('/:id/permanent', requireSpaceRole("admin", "manager"), hardDeletePage);

// ── Shares ────────────────────────────────────────────────────────────────────
router.get('/:id/shares', requireSpaceRole("admin", "manager", "member"), listShares);
router.post('/:id/shares', requireSpaceRole("admin", "manager"), createShare);
router.delete('/:id/shares/:shareId', requireSpaceRole("admin", "manager"), revokeShare);
router.patch('/:id/shares/:shareId', requireSpaceRole("admin", "manager"), updateShare);

// ── Analytics & Updates ───────────────────────────────────────────────────────
import {
  recordPageView,
  getViewsSummary,
  getViewPermission,
  setViewPermission,
  getViewers,
  getUpdates,
  getEditors
} from '../controllers/motion-analytics.controller';

router.post('/:pageId/views', requireSpaceRole("admin", "manager", "member"), recordPageView);
router.get('/:pageId/views/summary', requireSpaceRole("admin", "manager", "member"), getViewsSummary);
router.get('/:pageId/view-permission', requireSpaceRole("admin", "manager", "member"), getViewPermission);
router.post('/:pageId/view-permission', requireSpaceRole("admin", "manager", "member"), setViewPermission);
router.get('/:pageId/viewers', requireSpaceRole("admin", "manager", "member"), getViewers);
router.get('/:pageId/updates', requireSpaceRole("admin", "manager", "member"), getUpdates);
router.get('/:pageId/editors', requireSpaceRole("admin", "manager", "member"), getEditors);

// ── Motion AI ─────────────────────────────────────────────────────────────────
import { handleMotionAi } from '../controllers/motion-ai.controller';
router.post('/:pageId/ai', aiRateLimiter, aiDailyRateLimiter, requireSpaceRole("admin", "manager", "member"), handleMotionAi);

export default router;
