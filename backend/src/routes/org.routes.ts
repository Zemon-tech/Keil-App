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
import { createSpace, getSpaceMembers, getSpaces } from "../controllers/space.controller";

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
router.get("/:orgId/spaces", requireOrgMember, getSpaces);
router.post("/:orgId/spaces", requireOrgMember, createSpace);
router.get("/:orgId/spaces/:spaceId/members", requireOrgMember, requireSpaceMember, getSpaceMembers);

export default router;
