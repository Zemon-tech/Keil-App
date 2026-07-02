import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  AlertCircle,
  Lock,
  Sun,
  Moon,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import {
  useMotionPage,
  useSharedToSpace,
  useMotionSocketListeners,
  type MotionPageDTO,
  type MotionPermission,
} from "@/hooks/api/useMotionPages";
import { cn } from "@/lib/utils";
import { PageIcon } from "./MotionSidebar";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name.charAt(0).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

// ─── SharedMotionViewer ───────────────────────────────────────────────────────
//
// Authenticated, fully responsive viewer for space-shared Motion pages.
// Mounted at /shared/:pageId — outside MobileBlocker so it works on any device.
//
// Access flow:
//   1. User must be logged in (redirects to /login?next=/shared/:pageId otherwise)
//   2. Backend enforces permission via findByIdSharedToSpace (JWT + org/space check)
//   3. Frontend maps share_permission → editable flag for SimpleEditor
//   4. Real-time permission sync via useMotionSocketListeners
//   5. 403 / revoked access → shows AccessRevokedState

// ─── Permission helpers ───────────────────────────────────────────────────────

/** Returns true if the share permission grants the current space member edit rights. */
function canEdit(perm: MotionPermission | undefined): boolean {
  if (!perm) return false;
  return perm === "edit" || perm === "edit_all" || perm === "edit_managers" || perm === "edit_admins";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AuthRequiredState({ returnPath }: { returnPath: string }) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
      <Lock className="size-10 text-muted-foreground/50" />
      <div>
        <h1 className="text-xl font-bold">Sign in to view this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This page has been shared with you — log in to access it.
        </p>
      </div>
      <Link
        to={`/login?next=${encodeURIComponent(returnPath)}`}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}

function AccessDeniedState() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
      <AlertCircle className="size-10 text-muted-foreground/50" />
      <div>
        <h1 className="text-xl font-bold">Access removed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The owner has revoked your access to this page or it no longer exists.
        </p>
      </div>
      <Link
        to="/"
        className="mt-2 text-sm text-primary hover:underline underline-offset-4"
      >
        Back to KeilHQ
      </Link>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
      <AlertCircle className="size-10 text-destructive/50" />
      <div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unable to load this page. Please try again later.
        </p>
      </div>
    </div>
  );
}

// ─── Shared page sidebar item (lightweight) ───────────────────────────────────

function SharedPageSidebarItem({
  page,
  currentPageId,
  allPages,
  level = 0,
}: {
  page: MotionPageDTO;
  currentPageId: string | undefined;
  allPages: MotionPageDTO[];
  level?: number;
}) {
  const [open, setOpen] = useState(false);
  const children = allPages.filter((p) => p.parent_id === page.id && !p.deleted_at);
  const hasChildren = children.length > 0;
  const isActive = page.id === currentPageId;

  return (
    <div className="flex flex-col w-full">
      <div
        className={cn(
          "group flex min-h-8 w-full items-center rounded-md py-1 text-sm transition-colors cursor-pointer select-none",
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) setOpen((v) => !v);
        }}
      >
        {/* Expand chevron */}
        <span className="mr-1 shrink-0 text-muted-foreground/50">
          {hasChildren ? (
            open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />
          ) : (
            <span className="size-3 block" />
          )}
        </span>

        <PageIcon icon={page.icon} className="mr-1.5 shrink-0" />

        {page.sharer_name ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={`/shared/${page.id}`}
                  className="flex-1 truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {page.title || "Untitled"}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs p-2 max-w-xs space-y-0.5 bg-popover border border-border text-popover-foreground rounded shadow z-50">
                <div className="flex items-center gap-1.5">
                  {page.sharer_avatar_url ? (
                    <img
                      src={page.sharer_avatar_url}
                      alt={page.sharer_name}
                      className="size-4 rounded-full object-cover border border-border/50"
                    />
                  ) : (
                    <span className="size-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center text-[8px] font-bold">
                      {getInitials(page.sharer_name, page.sharer_email || "")}
                    </span>
                  )}
                  <span className="font-semibold text-foreground">{page.sharer_name}</span>
                </div>
                {page.sharer_email && <p className="text-muted-foreground text-[10px] pl-5.5">{page.sharer_email}</p>}
                {page.shared_at && (
                  <p className="text-[9px] text-muted-foreground/75 pl-5.5">
                    Shared {new Date(page.shared_at).toLocaleDateString([], { dateStyle: 'short' })}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Link
            to={`/shared/${page.id}`}
            className="flex-1 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {page.title || "Untitled"}
          </Link>
        )}
      </div>

      {open && hasChildren && (
        <div>
          {children.map((child) => (
            <SharedPageSidebarItem
              key={child.id}
              page={child}
              currentPageId={currentPageId}
              allPages={allPages}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SharedMotionViewer() {
  const { pageId } = useParams<{ pageId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accessState, setAccessState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  // Fetch the page via the authenticated API — backend enforces findByIdSharedToSpace
  const {
    data: serverPage,
    isLoading: isPageLoading,
    isError: isPageError,
    error: pageError,
  } = useMotionPage(activeOrgId, activeSpaceId, pageId ?? null);

  // Shared pages list for the sidebar
  const { data: sharedPages = [] } = useSharedToSpace(activeOrgId, activeSpaceId);

  // Root shared pages for sidebar (no parent)
  const rootSharedPages = sharedPages.filter((p) => !p.parent_id && !p.deleted_at);

  // Real-time permission sync — picks up revocations and content changes instantly
  useMotionSocketListeners(activeOrgId, activeSpaceId, pageId ?? null, user?.id ?? null);

  // Derive access state
  useEffect(() => {
    if (authLoading || isPageLoading) {
      setAccessState("loading");
      return;
    }
    if (!user) {
      setAccessState("loading"); // handled by auth guard below
      return;
    }
    if (isPageError) {
      const status = (pageError as any)?.response?.status;
      if (status === 403 || status === 404) {
        setAccessState("denied");
      } else {
        setAccessState("error");
      }
      return;
    }
    if (serverPage) {
      setAccessState("ok");
    }
  }, [authLoading, isPageLoading, isPageError, pageError, serverPage, user]);

  // ── Auth guard ────────────────────────────────────────────────────────────
  // Wait until auth loading is complete before making decisions
  if (authLoading) return <LoadingState />;

  // Redirect unauthenticated users to login with a return URL
  if (!user) {
    return <AuthRequiredState returnPath={`/shared/${pageId}`} />;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (accessState === "loading") return <LoadingState />;

  // ── Access denied / revoked ───────────────────────────────────────────────
  if (accessState === "denied") return <AccessDeniedState />;

  // ── Error ─────────────────────────────────────────────────────────────────
  if (accessState === "error") return <ErrorState />;

  // ── Page ──────────────────────────────────────────────────────────────────
  if (!serverPage) return <LoadingState />;

  const permission = serverPage.share_permission;
  const isEditable = canEdit(permission);

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "h-full flex flex-col border-r border-border/50 bg-card transition-all duration-300 ease-in-out overflow-hidden shrink-0",
          sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        {/* Sidebar header */}
        <div className="h-12 flex items-center px-4 border-b border-border/40 gap-2 shrink-0">
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate flex-1">
            Shared with Me
          </span>
        </div>

        {/* Shared pages tree */}
        <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar-smv">
          {rootSharedPages.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No shared pages yet.
            </div>
          ) : (
            rootSharedPages.map((page) => (
              <SharedPageSidebarItem
                key={page.id}
                page={page}
                currentPageId={pageId}
                allPages={sharedPages}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-12 flex items-center gap-2 px-4 border-b border-border/40 shrink-0">
          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            className="size-8 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          {/* Page icon + title */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <PageIcon icon={serverPage.icon} className="shrink-0" />
            <span className="text-sm font-medium truncate text-foreground/80">
              {serverPage.title || "Untitled"}
            </span>
          </div>

          {/* Share attribution */}
          {serverPage && serverPage.sharer_name && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-full pl-1.5 pr-2.5 py-0.5 text-xs text-muted-foreground select-none cursor-help shrink-0">
                    {serverPage.sharer_avatar_url ? (
                      <img
                        src={serverPage.sharer_avatar_url}
                        alt={serverPage.sharer_name}
                        className="size-4.5 rounded-full object-cover border border-border/50 shrink-0"
                      />
                    ) : (
                      <span className="size-4.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0">
                        {getInitials(serverPage.sharer_name, serverPage.sharer_email || "")}
                      </span>
                    )}
                    <span className="font-medium max-w-[120px] truncate text-foreground/80">
                      Shared by {serverPage.sharer_name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="text-xs p-2.5 max-w-xs space-y-1 bg-popover border border-border text-popover-foreground rounded-lg shadow-md z-50">
                  <p className="font-semibold text-foreground/90">{serverPage.sharer_name}</p>
                  {serverPage.sharer_email && (
                    <p className="text-muted-foreground">{serverPage.sharer_email}</p>
                  )}
                  {serverPage.shared_at && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Shared on {new Date(serverPage.shared_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Permission badge */}
          <span
            className={cn(
              "hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border shrink-0",
              isEditable
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            {isEditable ? "Can edit" : "View only"}
          </span>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="size-8 text-muted-foreground hover:text-foreground shrink-0"
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? (
              <Sun className="size-4 text-amber-500" />
            ) : (
              <Moon className="size-4 text-indigo-500" />
            )}
          </Button>
        </div>

        {/* Page content area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-smv">
          {/* Cover image */}
          {serverPage.cover_image && (
            <div className="w-full h-[180px] sm:h-[240px] overflow-hidden bg-muted shrink-0">
              <img
                src={serverPage.cover_image}
                alt="cover"
                className="size-full object-cover"
                style={{ objectPosition: `center ${serverPage.cover_position ?? 50}%` }}
              />
            </div>
          )}

          {/* Content wrapper — matches MotionPage layout */}
          <div
            className={cn(
              "mx-auto w-full px-4 sm:px-8 pt-8 pb-24",
              serverPage.full_width ? "max-w-none" : "max-w-[900px]"
            )}
          >
            {/* Page icon display */}
            {serverPage.icon && (
              <div className="mb-3 text-4xl sm:text-5xl">
                <PageIcon icon={serverPage.icon} className="size-10 sm:size-12" />
              </div>
            )}

            {/* Title */}
            <h1
              className={cn(
                "font-bold tracking-tight text-foreground/90 mb-6 leading-tight",
                serverPage.small_text
                  ? "text-2xl sm:text-3xl"
                  : "text-3xl sm:text-[44px] sm:leading-[1.1]"
              )}
            >
              {serverPage.title || "Untitled"}
            </h1>

            {/* Editor */}
            <SimpleEditor
              key={serverPage.id}
              content={serverPage.content}
              editable={isEditable}
            />
          </div>
        </div>
      </div>

      {/* Scoped scrollbar styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar-smv::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar-smv::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
          .custom-scrollbar-smv:hover::-webkit-scrollbar-thumb { background: var(--muted); }
        `
      }} />
    </div>
  );
}
