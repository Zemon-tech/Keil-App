import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { requireOrgMember, requireSpaceMember } from '../middlewares/org-context.middleware';
import { requireSpaceRole } from '../middlewares/rbac.middleware';
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
  listSharedToSpace,
} from '../controllers/motion-page.controller';

const router = Router({ mergeParams: true });

// All routes require authentication + org membership + space membership
router.use(protect, requireOrgMember, requireSpaceMember);

// ── Page CRUD ─────────────────────────────────────────────────────────────────
router.get('/', requireSpaceRole("admin", "manager", "member"), listPages);
router.post('/', requireSpaceRole("admin", "manager"), createPage);
router.get('/trash', requireSpaceRole("admin", "manager", "member"), listTrash);
router.get('/shared', requireSpaceRole("admin", "manager", "member"), listSharedToSpace);
router.get('/:id', requireSpaceRole("admin", "manager", "member"), getPage);
router.patch('/:id', requireSpaceRole("admin", "manager"), updatePage);
router.delete('/:id', requireSpaceRole("admin", "manager"), softDeletePage);
router.patch('/:id/restore', requireSpaceRole("admin", "manager"), restorePage);
router.delete('/:id/permanent', requireSpaceRole("admin", "manager"), hardDeletePage);

// ── Shares ────────────────────────────────────────────────────────────────────
router.get('/:id/shares', requireSpaceRole("admin", "manager", "member"), listShares);
router.post('/:id/shares', requireSpaceRole("admin", "manager"), createShare);
router.delete('/:id/shares/:shareId', requireSpaceRole("admin", "manager"), revokeShare);

export default router;
