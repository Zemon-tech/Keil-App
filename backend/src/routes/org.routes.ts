import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import { getOrganisations } from "../controllers/organisation.controller";
import { getSpaces, getSpaceMembers } from "../controllers/space.controller";

const router = Router();

router.use(protect);

router.get("/", getOrganisations);
router.get("/:orgId/spaces", requireOrgMember, getSpaces);
router.get("/:orgId/spaces/:spaceId/members", requireOrgMember, requireSpaceMember, getSpaceMembers);

export default router;
