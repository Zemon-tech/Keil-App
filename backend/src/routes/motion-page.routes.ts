import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { requireOrgMember, requireSpaceMember } from '../middlewares/org-context.middleware';
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
router.get('/', listPages);
router.post('/', createPage);
router.get('/trash', listTrash);
router.get('/shared', listSharedToSpace);
router.get('/:id', getPage);
router.patch('/:id', updatePage);
router.delete('/:id', softDeletePage);
router.patch('/:id/restore', restorePage);
router.delete('/:id/permanent', hardDeletePage);

// ── Shares ────────────────────────────────────────────────────────────────────
router.get('/:id/shares', listShares);
router.post('/:id/shares', createShare);
router.delete('/:id/shares/:shareId', revokeShare);

export default router;
