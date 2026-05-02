import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import {
  createOrganisation,
  createOrgInvite,
  getOrgMembers,
  getOrganisations,
  joinOrg,
} from "../controllers/organisation.controller";
import {
  addSpaceMember,
  createSpace,
  deleteSpace,
  getDeletedSpaces,
  getSpaceMembers,
  getSpaces,
  hardDeleteSpace,
  removeSpaceMember,
  renameSpace,
  restoreSpace,
} from "../controllers/space.controller";

const router = Router();

router.use(protect);

// ── Organisation list & creation ──────────────────────────────────────────────
router.get("/", getOrganisations);
router.post("/", createOrganisation);

// ── Top-level join (token encodes orgId — no :orgId needed in URL) ────────────
router.post("/join", joinOrg);

// ── Org-scoped routes (membership required) ───────────────────────────────────
router.get("/:orgId/members", requireOrgMember, getOrgMembers);
router.post("/:orgId/invite", requireOrgMember, createOrgInvite);

// ── Space routes ──────────────────────────────────────────────────────────────
// NOTE: /deleted must be registered before /:spaceId to avoid Express treating
// the literal string "deleted" as a spaceId parameter.
router.get("/:orgId/spaces", requireOrgMember, getSpaces);
router.post("/:orgId/spaces", requireOrgMember, createSpace);
router.get("/:orgId/spaces/deleted", requireOrgMember, getDeletedSpaces);

// Space-scoped routes (space must exist and not be deleted)
router.patch("/:orgId/spaces/:spaceId", requireOrgMember, requireSpaceMember, renameSpace);
router.delete("/:orgId/spaces/:spaceId", requireOrgMember, requireSpaceMember, deleteSpace);

// Restore and hard-delete operate on soft-deleted spaces — requireSpaceMember
// would block them (it filters deleted_at IS NULL), so only requireOrgMember is used.
router.post("/:orgId/spaces/:spaceId/restore", requireOrgMember, restoreSpace);
router.delete("/:orgId/spaces/:spaceId/permanent", requireOrgMember, hardDeleteSpace);

// Space member management
router.get("/:orgId/spaces/:spaceId/members", requireOrgMember, requireSpaceMember, getSpaceMembers);
router.post("/:orgId/spaces/:spaceId/members", requireOrgMember, requireSpaceMember, addSpaceMember);
router.delete("/:orgId/spaces/:spaceId/members/:userId", requireOrgMember, requireSpaceMember, removeSpaceMember);

export default router;
