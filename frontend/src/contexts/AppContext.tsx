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
import { useAuth } from "@/contexts/AuthContext";

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

  // ── Cross-tab sync via storage events ────────────────────────────────────
  // When a different tab writes keil_active_org or keil_active_space, the
  // browser fires a "storage" event on all OTHER tabs. We listen here so
  // every open tab stays in sync without a page reload.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_ORG_ID && e.newValue !== null) {
        setActiveOrgId(e.newValue);
      }
      if (e.key === STORAGE_SPACE_ID) {
        setActiveSpaceId(e.newValue); // null means the key was removed
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Auth readiness ────────────────────────────────────────────────────────
  const { isAuthenticated } = useAuth();

  // ── Restore persisted state ──────────────────────────────────────────────
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_ORG_ID);
  });

  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_SPACE_ID);
  });

  // ── Remote data ───────────────────────────────────────────────────────────
  // Guard: only fetch orgs once the user is authenticated.
  const {
    data: organisations = [],
    isLoading: isLoadingOrgs,
    isSuccess: isOrgsSuccess,
  } = useOrganisations(isAuthenticated);
  const { data: spaces = [], isLoading: isLoadingSpaces } = useSpaces(activeOrgId);

  // ── Combined auto-select + membership validation ──────────────────────────
  // This single effect handles both "no org stored → pick personal" and
  // "stored org is stale → fall back to personal". It only runs after a
  // confirmed successful fetch (isOrgsSuccess), preventing the race condition
  // where an empty default array would incorrectly trigger a fallback.
  useEffect(() => {
    // Don't act until we have a real, successful response from the server.
    if (!isOrgsSuccess || isLoadingOrgs) return;

    // Case 1: No org stored — auto-select personal.
    if (!activeOrgId) {
      if (organisations.length === 0) return;
      const personal = organisations.find((o) => o.is_personal);
      if (personal) {
        setActiveOrgId(personal.id);
        localStorage.setItem(STORAGE_ORG_ID, personal.id);
      }
      return;
    }

    // Case 2: Org stored — validate membership.
    if (organisations.length === 0) {
      // User genuinely has no orgs (edge case). Clear stored state.
      setActiveOrgId(null);
      setActiveSpaceId(null);
      localStorage.removeItem(STORAGE_ORG_ID);
      localStorage.removeItem(STORAGE_SPACE_ID);
      return;
    }

    const stillMember = organisations.some((o) => o.id === activeOrgId);
    if (!stillMember) {
      // User was removed from the stored org — fall back to personal.
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
  }, [organisations, isLoadingOrgs, isOrgsSuccess, activeOrgId]);

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
