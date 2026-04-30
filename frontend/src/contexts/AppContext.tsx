/**
 * AppContext — Platform / Organisation / Space app-level context.
 *
 * This is the new source of truth for the active mode and active org/space.
 * It sits alongside the legacy WorkspaceContext during the Phase 3 → 5 transition.
 * WorkspaceContext continues to serve legacy hooks unchanged.
 *
 * Context rules:
 * - A user with no organisations is valid; they land in "personal" mode.
 * - Personal mode must never fire org/space queries.
 * - Organisation mode requires both activeOrgId and activeSpaceId to be set
 *   before org-scoped queries run.
 * - Switching org clears or recalculates the active space.
 * - Active org and space are persisted to localStorage under new keys so they
 *   do not collide with the legacy "keil_active_workspace" key.
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

const STORAGE_MODE     = "keil_app_mode";       // "personal" | "organisation"
const STORAGE_ORG_ID   = "keil_active_org";     // uuid
const STORAGE_SPACE_ID = "keil_active_space";   // uuid

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppMode = "personal" | "organisation";

export interface AppContextType {
  /** Current operating mode. */
  mode: AppMode;

  /** The currently selected organisation id (null when personal mode). */
  activeOrgId: string | null;

  /** The currently selected space id (null when personal mode or no space chosen). */
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

  /** Switch to personal mode. Clears org and space selections. */
  setPersonalMode: () => void;

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
  // ── Restore persisted state ──────────────────────────────────────────────
  const [mode, setMode] = useState<AppMode>(() => {
    const stored = localStorage.getItem(STORAGE_MODE);
    return stored === "organisation" ? "organisation" : "personal";
  });

  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_ORG_ID);
  });

  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_SPACE_ID);
  });

  // ── Remote data ───────────────────────────────────────────────────────────
  const { data: organisations = [], isLoading: isLoadingOrgs } = useOrganisations();
  const { data: spaces = [], isLoading: isLoadingSpaces } = useSpaces(
    mode === "organisation" ? activeOrgId : null
  );

  // ── Auto-select first org when user has orgs but none is stored ───────────
  useEffect(() => {
    if (isLoadingOrgs) return;

    // If the stored org is no longer in the list (e.g. user was removed),
    // clear it and fall back to personal mode.
    if (activeOrgId) {
      const stillMember = organisations.some((o) => o.id === activeOrgId);
      if (!stillMember) {
        setMode("personal");
        setActiveOrgId(null);
        setActiveSpaceId(null);
        localStorage.removeItem(STORAGE_MODE);
        localStorage.removeItem(STORAGE_ORG_ID);
        localStorage.removeItem(STORAGE_SPACE_ID);
      }
    }
    // Never auto-switch to org mode — the user must choose.
    // A user with no orgs stays in personal mode.
  }, [organisations, isLoadingOrgs, activeOrgId]);

  // ── Auto-select space when org becomes active ─────────────────────────────
  useEffect(() => {
    if (mode !== "organisation" || !activeOrgId || isLoadingSpaces) return;
    if (spaces.length === 0) return;

    // Validate stored space still belongs to this org and user is still a member
    if (activeSpaceId) {
      const stillInSpace = spaces.some((s) => s.id === activeSpaceId);
      if (!stillInSpace) {
        // Space is gone — pick the first available one
        const first = spaces[0];
        setActiveSpaceId(first.id);
        localStorage.setItem(STORAGE_SPACE_ID, first.id);
      }
    }
    // If no space stored at all, pick the first one automatically
    if (!activeSpaceId) {
      const first = spaces[0];
      setActiveSpaceId(first.id);
      localStorage.setItem(STORAGE_SPACE_ID, first.id);
    }
  }, [spaces, isLoadingSpaces, mode, activeOrgId, activeSpaceId]);

  // ── Derived objects ───────────────────────────────────────────────────────
  const activeOrg = useMemo(
    () => organisations.find((o) => o.id === activeOrgId) ?? null,
    [organisations, activeOrgId]
  );

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const setPersonalMode = useCallback(() => {
    setMode("personal");
    setActiveOrgId(null);
    setActiveSpaceId(null);
    localStorage.setItem(STORAGE_MODE, "personal");
    localStorage.removeItem(STORAGE_ORG_ID);
    localStorage.removeItem(STORAGE_SPACE_ID);
  }, []);

  const setActiveOrganisation = useCallback(
    (orgId: string, lastSpaceId?: string | null) => {
      setMode("organisation");
      setActiveOrgId(orgId);
      localStorage.setItem(STORAGE_MODE, "organisation");
      localStorage.setItem(STORAGE_ORG_ID, orgId);

      // If a preferred space is passed AND it belongs to the new org, use it.
      // Otherwise clear — the space auto-select effect will pick from the list.
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
      activeOrgId,
      activeSpaceId,
      organisations,
      spaces,
      activeOrg,
      activeSpace,
      isLoadingOrgs,
      isLoadingSpaces,
      setPersonalMode,
      setActiveOrganisation,
      setActiveSpace,
    }),
    [
      mode,
      activeOrgId,
      activeSpaceId,
      organisations,
      spaces,
      activeOrg,
      activeSpace,
      isLoadingOrgs,
      isLoadingSpaces,
      setPersonalMode,
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
