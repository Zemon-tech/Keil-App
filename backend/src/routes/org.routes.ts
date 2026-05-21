import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import { requireOrgRole, requireSpaceRole } from "../middlewares/rbac.middleware";
import {
  createOrganisation,
  createOrgInvite,
  deleteOrganisation,
  getOrgMembers,
  getOrganisations,
  joinOrg,
  removeOrgMember,
  renameOrganisation,
  updateOrgMemberRole,
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
  updateSpaceMemberRole,
} from "../controllers/space.controller";

const router = Router();

router.use(protect);

// ── Organisation list & creation ──────────────────────────────────────────────
router.get("/", getOrganisations);
router.post("/", createOrganisation);

// ── Top-level join (token encodes orgId — no :orgId needed in URL) ────────────
router.post("/join", joinOrg);

// ── Org-scoped routes (membership required) ───────────────────────────────────
router.patch("/:orgId", requireOrgMember, requireOrgRole("owner", "admin"), renameOrganisation);
router.delete("/:orgId", requireOrgMember, requireOrgRole("owner"), deleteOrganisation);
router.get("/:orgId/members", requireOrgMember, getOrgMembers);
router.post("/:orgId/invite", requireOrgMember, requireOrgRole("owner", "admin"), createOrgInvite);
router.patch("/:orgId/members/:userId", requireOrgMember, requireOrgRole("owner", "admin"), updateOrgMemberRole);
router.delete("/:orgId/members/:userId", requireOrgMember, requireOrgRole("owner", "admin"), removeOrgMember);

// ── Space routes ──────────────────────────────────────────────────────────────
// NOTE: /deleted must be registered before /:spaceId to avoid Express treating
// the literal string "deleted" as a spaceId parameter.
router.get("/:orgId/spaces", requireOrgMember, getSpaces);
router.post("/:orgId/spaces", requireOrgMember, requireOrgRole("owner", "admin"), createSpace);
router.get("/:orgId/spaces/deleted", requireOrgMember, getDeletedSpaces);

// Space-scoped routes (space must exist and not be deleted)
// Note: Space-management operations (rename, delete) are Org-level admin powers and do not require space membership.
router.patch("/:orgId/spaces/:spaceId", requireOrgMember, requireOrgRole("owner", "admin"), renameSpace);
router.delete("/:orgId/spaces/:spaceId", requireOrgMember, requireOrgRole("owner", "admin"), deleteSpace);

// Restore and hard-delete operate on soft-deleted spaces — requireSpaceMember
// would block them (it filters deleted_at IS NULL), so only requireOrgMember is used.
router.post("/:orgId/spaces/:spaceId/restore", requireOrgMember, requireOrgRole("owner", "admin"), restoreSpace);
router.delete("/:orgId/spaces/:spaceId/permanent", requireOrgMember, requireOrgRole("owner", "admin"), hardDeleteSpace);

// Space member management
router.get("/:orgId/spaces/:spaceId/members", requireOrgMember, requireSpaceMember, getSpaceMembers);
router.post("/:orgId/spaces/:spaceId/members", requireOrgMember, requireOrgRole("owner", "admin"), addSpaceMember);
router.delete("/:orgId/spaces/:spaceId/members/:userId", requireOrgMember, requireOrgRole("owner", "admin"), removeSpaceMember);
router.patch(
  "/:orgId/spaces/:spaceId/members/:userId",
  requireOrgMember,
  requireSpaceMember,
  requireSpaceRole("admin"),
  updateSpaceMemberRole
);

export default router;
