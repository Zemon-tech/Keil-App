/**
 * AppContext — Platform / Organisation / Space app-level context.
 *
 * This is the single source of truth for the active mode and active org/space.
 *
 * Context rules:
 * - A user with no organisations is valid; they land in "personal" mode.
 * - Personal mode must never fire org/space queries.
 * - Organisation mode requires both activeOrgId and activeSpaceId to be set
 *   before org-scoped queries run.
 * - Switching org clears or recalculates the active space.
 * - Active org and space are persisted to localStorage under dedicated keys.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOrganisations, type Organisation } from "@/hooks/api/useOrganisations";
import { useSpaces, type Space } from "@/hooks/api/useSpaces";

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_MODE     = "keil_app_mode";    // "personal" | "organisation"
const STORAGE_ORG_ID   = "keil_active_org";  // uuid
const STORAGE_SPACE_ID = "keil_active_space"; // uuid

// Legacy key written by the old WorkspaceContext — cleaned up on first load.
const LEGACY_WORKSPACE_KEY = "keil_active_workspace";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppMode = "personal" | "organisation";

export interface AppContextType {
  /** Current operating mode (derived from active organisation). */
  mode: AppMode;

  /** True if the active organisation is a personal organisation. */
  isPersonalOrg: boolean;

  /** The currently selected organisation id. */
  activeOrgId: string | null;

  /** The currently selected space id. */
  activeSpaceId: string | null;

  /** Full list of the user's organisations. Empty array when user has none. */
  organisations: Organisation[];

  /** Spaces visible to the user in the active organisation. */
  spaces: Space[];

  /** Full data object for the active organisation. */
  activeOrg: Organisation | null;

  /** Full data object for the active space. */
  activeSpace: Space | null;

  /** True while the initial organisations list is loading. */
  isLoadingOrgs: boolean;

  /** True while the spaces list for the active org is loading. */
  isLoadingSpaces: boolean;

  /** Switch to personal mode (selects the personal organisation). */
  setPersonalMode: () => void;

  /**
   * Switch to organisation mode.
   * @deprecated No-op under personal organisation model.
   */
  setOrganisationMode: () => void;

  /**
   * Switch to organisation mode and activate the given org.
   * If lastSpaceId is provided it will be used as the active space
   * (only if that space belongs to this org). Otherwise the first
   * visible space is selected automatically.
   */
  setActiveOrganisation: (orgId: string, lastSpaceId?: string | null) => void;

  /** Change the active space within the current org. */
  setActiveSpace: (spaceId: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // ── One-time legacy key cleanup ───────────────────────────────────────────
  // Remove the old WorkspaceContext key and old mode key so they don't linger.
  useEffect(() => {
    localStorage.removeItem(LEGACY_WORKSPACE_KEY);
    localStorage.removeItem(STORAGE_MODE);
  }, []);

  // ── Restore persisted state ──────────────────────────────────────────────
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_ORG_ID);
  });

  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_SPACE_ID);
  });

  // ── Remote data ───────────────────────────────────────────────────────────
  const { data: organisations = [], isLoading: isLoadingOrgs } = useOrganisations();
  const { data: spaces = [], isLoading: isLoadingSpaces } = useSpaces(activeOrgId);

  // ── Auto-select personal organisation on load if none active ──────────────
  useEffect(() => {
    if (isLoadingOrgs || organisations.length === 0) return;
    if (!activeOrgId) {
      const personal = organisations.find((o) => o.is_personal);
      if (personal) {
        setActiveOrgId(personal.id);
        localStorage.setItem(STORAGE_ORG_ID, personal.id);
      }
    }
  }, [organisations, isLoadingOrgs, activeOrgId]);

  // ── Membership validation: clear stale org from storage / fallback to personal ──────────────────
  useEffect(() => {
    if (isLoadingOrgs) return;

    if (activeOrgId) {
      const stillMember = organisations.some((o) => o.id === activeOrgId);
      if (!stillMember) {
        const personal = organisations.find((o) => o.is_personal);
        if (personal) {
          setActiveOrgId(personal.id);
          setActiveSpaceId(null);
          localStorage.setItem(STORAGE_ORG_ID, personal.id);
          localStorage.removeItem(STORAGE_SPACE_ID);
        } else {
          setActiveOrgId(null);
          setActiveSpaceId(null);
          localStorage.removeItem(STORAGE_ORG_ID);
          localStorage.removeItem(STORAGE_SPACE_ID);
        }
      }
    }
  }, [organisations, isLoadingOrgs, activeOrgId]);

  // ── Auto-select space when org becomes active ─────────────────────────────
  useEffect(() => {
    if (!activeOrgId || isLoadingSpaces) return;
    if (spaces.length === 0) return;

    if (activeSpaceId) {
      const stillInSpace = spaces.some((s) => s.id === activeSpaceId);
      if (!stillInSpace) {
        const first = spaces[0];
        setActiveSpaceId(first.id);
        localStorage.setItem(STORAGE_SPACE_ID, first.id);
      }
    }
    if (!activeSpaceId) {
      const first = spaces[0];
      setActiveSpaceId(first.id);
      localStorage.setItem(STORAGE_SPACE_ID, first.id);
    }
  }, [spaces, isLoadingSpaces, activeOrgId, activeSpaceId]);

  // ── Derived objects ───────────────────────────────────────────────────────
  const activeOrg = useMemo(
    () => organisations.find((o) => o.id === activeOrgId) ?? null,
    [organisations, activeOrgId]
  );

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  const mode = useMemo<AppMode>(() => {
    return activeOrg?.is_personal ? "personal" : "organisation";
  }, [activeOrg]);

  const isPersonalOrg = useMemo(() => {
    return activeOrg?.is_personal ?? false;
  }, [activeOrg]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setPersonalMode = useCallback(() => {
    const personal = organisations.find((o) => o.is_personal);
    if (personal) {
      setActiveOrgId(personal.id);
      setActiveSpaceId(null);
      localStorage.setItem(STORAGE_ORG_ID, personal.id);
      localStorage.removeItem(STORAGE_SPACE_ID);
    }
  }, [organisations]);

  const setOrganisationMode = useCallback(() => {
    // Deprecated: no-op under personal organisation model.
  }, []);

  const setActiveOrganisation = useCallback(
    (orgId: string, lastSpaceId?: string | null) => {
      setActiveOrgId(orgId);
      localStorage.setItem(STORAGE_ORG_ID, orgId);

      if (lastSpaceId) {
        setActiveSpaceId(lastSpaceId);
        localStorage.setItem(STORAGE_SPACE_ID, lastSpaceId);
      } else {
        setActiveSpaceId(null);
        localStorage.removeItem(STORAGE_SPACE_ID);
      }
    },
    []
  );

  const setActiveSpace = useCallback((spaceId: string) => {
    setActiveSpaceId(spaceId);
    localStorage.setItem(STORAGE_SPACE_ID, spaceId);
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value: AppContextType = useMemo(
    () => ({
      mode,
      isPersonalOrg,
      activeOrgId,
      activeSpaceId,
      organisations,
      spaces,
      activeOrg,
      activeSpace,
      isLoadingOrgs,
      isLoadingSpaces,
      setPersonalMode,
      setOrganisationMode,
      setActiveOrganisation,
      setActiveSpace,
    }),
    [
      mode,
      isPersonalOrg,
      activeOrgId,
      activeSpaceId,
      organisations,
      spaces,
      activeOrg,
      activeSpace,
      isLoadingOrgs,
      isLoadingSpaces,
      setPersonalMode,
      setOrganisationMode,
      setActiveOrganisation,
      setActiveSpace,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the platform/org/space app context.
 * Throws a clear error if used outside <AppProvider>.
 */
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
