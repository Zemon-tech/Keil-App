import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Menu, MoreHorizontal, Trash2, ChevronRight, Share2, Search, Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap, Sparkles, FileText, Image as ImageLucide, Smile, Copy, AArrowDown, MoveHorizontal, SlidersHorizontal, Lock, Undo2, History
} from "lucide-react";
import { MotionSharePanel } from "./MotionShareModal";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MotionSidebar } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaceRole } from "@/hooks/useSpaceRole";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import {
  useMotionPage,
  useUpdateMotionPage,
  useSoftDeleteMotionPage,
  useCreateMotionPage,
  useMotionSocketListeners,
  useRestoreMotionPage,
} from "@/hooks/api/useMotionPages";
import { useRecordPageView } from "@/hooks/api/useMotionAnalytics";
import type { JSONContent } from "@tiptap/core";
import { toast } from "sonner";
import { saveDraft, getDraft, clearDraft } from "@/lib/motion-drafts";

// ─── Save status indicator ────────────────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "error" | "idle";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle" || status === "saved") return null;
  return (
    <span
      className={cn(
        "text-[11px] font-medium transition-opacity",
        status === "saving" && "text-muted-foreground/60",
        status === "error" && "text-destructive/70"
      )}
    >
      {status === "saving" ? "Saving…" : "Save failed"}
    </span>
  );
}

// ─── MotionPage ───────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1500;

export function MotionPage() {
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();
  const [pageEditor, setPageEditor] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editorKey, setEditorKey] = useState<string>(pageId ?? "");

  // Refs for exponential backoff retries
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: skip the first onUpdate from Tiptap (fires on mount with initial content)
  const isInitialMountRef = useRef<boolean>(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<'Emoji' | 'Icons' | 'Upload'>('Emoji');
  const [activeCoverTab, setActiveCoverTab] = useState<'Gallery' | 'Upload' | 'Link' | 'Unsplash'>('Gallery');
  const [emojiSearch, setEmojiSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // -- Dropdown State --
  const [menuSearch, setMenuSearch] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  // Draft position used only while repositioning — not saved until "Save position"
  const [draftPosition, setDraftPosition] = useState<number>(50);
  const coverContainerRef = useRef<HTMLDivElement>(null);

  const { activeOrgId, activeSpaceId, activeOrg, activeSpace } = useAppContext();
  const { user } = useAuth();
  const { spaceRole } = useSpaceRole();

  const matchesSearch = (text: string) => text.toLowerCase().includes(menuSearch.toLowerCase());

  const {
    sidebarOpen,
    setSidebarOpen,
    getPageById,
    upsertPages,
    setDirty,
    clearDirty,
    drawerOpen,
    setDrawerOpen,
    drawerTab,
    setDrawerTab,
    shareOpen,
    setShareOpen,
    setLastOpenedPageId,
  } = useMotionStore();

  const handleToggleDrawer = (tab: "updates" | "analytics") => {
    if (drawerOpen && drawerTab === tab) {
      setDrawerOpen(false);
    } else {
      setDrawerTab(tab);
      setDrawerOpen(true);
    }
  };

  const handleCopyContent = () => {
    if (pageEditor) {
      const text = pageEditor.getText();
      navigator.clipboard.writeText(text);
      toast("Content copied to clipboard");
    }
  };

  // Track last opened page so /motion can redirect back to it
  useEffect(() => {
    if (pageId && activeOrgId && activeSpaceId) {
      setLastOpenedPageId(activeOrgId, activeSpaceId, pageId);
    }
  }, [pageId, activeOrgId, activeSpaceId, setLastOpenedPageId]);
  // Stable ref so upsertPages is never a useEffect dependency
  const upsertPagesRef = useRef(upsertPages);
  upsertPagesRef.current = upsertPages;

  // ── API hooks ───────────────────────────────────────────────────────────────
  const { data: serverPage, isLoading } = useMotionPage(
    activeOrgId,
    activeSpaceId,
    pageId ?? null
  );
  const updatePage = useUpdateMotionPage(activeOrgId, activeSpaceId);
  const softDelete = useSoftDeleteMotionPage(activeOrgId, activeSpaceId);
  const restorePage = useRestoreMotionPage(activeOrgId, activeSpaceId);
  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);
  const recordPageView = useRecordPageView(activeOrgId, activeSpaceId, pageId ?? null);

  // ── Space members (must be called unconditionally — before any early returns) ──
  const { data: members = [] } = useSpaceMembers(activeOrgId, activeSpaceId);

  // ── Real-time ──
  useMotionSocketListeners(activeOrgId, activeSpaceId, pageId ?? null, user?.id ?? null);

  useEffect(() => {
    if (serverPage) {
      upsertPagesRef.current([serverPage]);
    }
  }, [serverPage]);

  // Record page view on load/navigation
  useEffect(() => {
    if (activeOrgId && activeSpaceId && pageId) {
      recordPageView.mutate();
    }
  }, [activeOrgId, activeSpaceId, pageId]);

  // ── Reconcile local draft on mount/navigation ──
  useEffect(() => {
    if (!pageId) return;

    // Reset the initial mount guard for the new page
    isInitialMountRef.current = true;

    const draft = getDraft(pageId);
    if (draft) {
      // Reconcile draft
      useMotionStore.getState().updatePageLocally(pageId, { content: draft });
      setDirty(pageId);
      toast.success("Unsaved changes recovered from a local draft.", {
        description: "We found a newer unsaved draft of this page.",
      });
      // Force SimpleEditor to re-mount with the draft content by updating the key
      setEditorKey(`${pageId}-draft-${Date.now()}`);
    } else {
      setEditorKey(pageId);
    }
  }, [pageId, setDirty]);

  // ── Working copy from store (optimistic) ───────────────────────────────────
  const page = useMemo(
    () => (pageId ? getPageById(pageId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId, serverPage, getPageById]
  );

  const parentPage = useMemo(
    () => (page?.parent_id ? getPageById(page.parent_id) : null),
    [page?.parent_id, getPageById]
  );

  // ── Derived display page (null-safe, used before guards) ───────────────────
  // Use the store page (optimistic) for metadata (title, icon, cover, etc.)
  // but the editor will only render when content is available from the detail query.
  const displayPage = page ?? serverPage ?? null;

  // Content specifically for the editor — only trust sources that include content.
  // The list query excludes content for performance, so we must wait for the detail query.
  const editorContent = (page?.content ? page.content : null) ?? serverPage?.content ?? undefined;

  const isSharedPage = displayPage && (displayPage.org_id !== activeOrgId || displayPage.space_id !== activeSpaceId);

  // Helper: does the share permission grant edit rights to the current user's space role?
  const sharedPageCanEdit = (() => {
    if (!isSharedPage || !displayPage) return false;
    const perm = displayPage.share_permission;
    // edit_all — any member of the target space can edit
    if (perm === "edit_all" || perm === "edit") return true;
    // edit_managers — only admins and managers of the target space can edit
    if (perm === "edit_managers") return spaceRole === "admin" || spaceRole === "manager";
    // edit_admins — only admins of the target space can edit
    if (perm === "edit_admins") return spaceRole === "admin";
    // view_* permissions — no edit access
    return false;
  })();

  const isPageReadOnly = isSharedPage
    ? !sharedPageCanEdit
    : spaceRole === "admin" ? false : spaceRole === "manager" ? displayPage?.created_by !== user?.id : true;

  useEffect(() => {
    if (pageEditor) {
      pageEditor.setEditable(!isLocked && !isPageReadOnly);
    }
  }, [isLocked, isPageReadOnly, pageEditor]);

  // ── Click outside cover to auto-save reposition ────────────────────────────
  useEffect(() => {
    if (!isRepositioning) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (coverContainerRef.current && !coverContainerRef.current.contains(e.target as Node)) {
        // Auto-save when clicking outside the cover area
        if (pageId) {
          useMotionStore.getState().updatePageLocally(pageId, { cover_position: draftPosition });
          updatePage.mutate({ id: pageId, updates: { cover_position: draftPosition } });
        }
        setIsRepositioning(false);
      }
    };

    // Use mousedown so it fires before click handlers elsewhere
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRepositioning, draftPosition, pageId]);

  // ── Last edited member ─────────────────────────────────────────────────────
  const lastEditedMember = useMemo(() => {
    if (!displayPage?.updated_by) return null;
    return members.find((m) => m.user_id === displayPage.updated_by);
  }, [members, displayPage?.updated_by]);

  // ── Redirect if page not found after load ───────────────────────────────────
  useEffect(() => {
    if (!isLoading && !serverPage && !page) {
      // Clear the invalid lastOpenedPageId so we don't end up in an infinite redirect loop
      if (activeOrgId && activeSpaceId) {
        setLastOpenedPageId(activeOrgId, activeSpaceId, null);
      }
      navigate("/motion", { replace: true });
    }
  }, [isLoading, serverPage, page, navigate, activeOrgId, activeSpaceId, setLastOpenedPageId]);

  // ── Title draft ─────────────────────────────────────────────────────────────
  const [titleDraft, setTitleDraft] = useState(page?.title ?? "");
  useEffect(() => {
    setTitleDraft(page?.title ?? "");
  }, [page?.title]);

  // ── Debounced content save ──────────────────────────────────────────────────
  // We use a ref-based debounce (no lodash.debounce dependency needed).
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef<JSONContent | null>(null);

  const flushSave = useCallback(async () => {
    if (!pageId || !pendingContent.current) return;
    const content = pendingContent.current;
    pendingContent.current = null;
    setSaveStatus("saving");

    // Clear any active retry timer to prevent concurrent retries
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    try {
      await updatePage.mutateAsync({ id: pageId, updates: { content } });
      setSaveStatus("saved");
      clearDirty(pageId);
      retryCountRef.current = 0; // Reset retry counter on success
      
      // Clear draft on successful save
      clearDraft(pageId);

      // Reset to idle after a short delay so "Saved" doesn't linger
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      retryCountRef.current += 1;

      if (retryCountRef.current <= 5) {
        const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (pendingContent.current === null) {
            pendingContent.current = content;
            flushSave();
          }
        }, delay);
      } else {
        // Stop retrying after 5 attempts
        console.warn(`Failed to save page ${pageId} after 5 attempts.`);
      }
    }
  }, [pageId, updatePage, clearDirty]);

  const handleContentChange = useCallback(
    (json: JSONContent) => {
      if (!pageId || isPageReadOnly) return;

      // Skip the first onUpdate from Tiptap — it fires on mount with the initial
      // content and should NOT trigger a save (it would overwrite the DB with
      // potentially stale/empty content from the cache).
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        return;
      }

      pendingContent.current = json;
      setDirty(pageId);
      setSaveStatus("saving");

      // Save draft dynamically to localStorage safety net
      saveDraft(pageId, json);

      // Clear any pending retry timers and reset retry count on new keystrokes
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // Reset debounce timer
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushSave, DEBOUNCE_MS);
    },
    [pageId, isPageReadOnly, setDirty, flushSave]
  );

  // Flush on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      // Fire-and-forget flush — we can't await in cleanup
      if (pendingContent.current && pageId && !isPageReadOnly) {
        updatePage.mutate({
          id: pageId,
          updates: { content: pendingContent.current },
        });
        pendingContent.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, isPageReadOnly]);

  // ── Title save (on blur) ────────────────────────────────────────────────────
  const handleTitleBlur = () => {
    if (!pageId || isPageReadOnly) return;
    const trimmed = titleDraft.trim() || "Untitled";
    if (trimmed !== page?.title) {
      // Optimistic update in store
      useMotionStore.getState().updatePageLocally(pageId, { title: trimmed });
      updatePage.mutate({ id: pageId, updates: { title: trimmed } });
    }
  };

  // ── Add subpage ─────────────────────────────────────────────────────────────
  const handleAddSubpage = async () => {
    if (!pageId || !pageEditor) return;
    const newPage = await createPage.mutateAsync({ parent_id: pageId });
    pageEditor.chain().focus().insertContent({
      type: "subpage",
      attrs: {
        id: newPage.id,
        title: newPage.title || "Untitled",
        icon: newPage.icon
      }
    }).run();
    navigate(`/motion/${newPage.id}`);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!pageId || !page) return;
    if (confirm("Are you sure you want to delete this page?")) {
      if (activeOrgId && activeSpaceId) {
        setLastOpenedPageId(activeOrgId, activeSpaceId, null);
      }
      softDelete.mutate({ id: pageId, title: page.title });
      navigate("/motion");
    }
  };

  const handleDeleteSubpage = useCallback(
    (subpageId: string) => {
      const pageRecord = getPageById(subpageId);
      const title = pageRecord?.title ?? "Untitled";
      softDelete.mutate({ id: subpageId, title });
    },
    [getPageById, softDelete]
  );

  const handleRestoreSubpage = useCallback(
    (subpageId: string) => {
      restorePage.mutate(subpageId);
    },
    [restorePage]
  );

  const toggleSmallText = () => {
    if (!pageId || !displayPage) return;
    const nextValue = !displayPage.small_text;
    useMotionStore.getState().updatePageLocally(pageId, { small_text: nextValue });
    updatePage.mutate({ id: pageId, updates: { small_text: nextValue } });
  };

  const toggleFullWidth = () => {
    if (!pageId || !displayPage) return;
    const nextValue = !displayPage.full_width;
    useMotionStore.getState().updatePageLocally(pageId, { full_width: nextValue });
    updatePage.mutate({ id: pageId, updates: { full_width: nextValue } });
  };

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!activeOrgId || !activeSpaceId) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">
          Select an organisation and space to use Motion.
        </p>
      </div>
    );
  }

  if (!displayPage) {
    return (
      <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative" />
    );
  }

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative">
      {/* ── Motion sidebar ── */}
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
          sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <MotionSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-2 z-40 shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="size-4" />
            </Button>
            {/* Org > Space breadcrumb */}
            {activeOrg && activeSpace && (
              <Breadcrumb>
                <BreadcrumbList className="flex-nowrap text-xs gap-1 sm:gap-1.5">
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-muted-foreground/60 font-medium max-w-[120px] truncate">
                      {activeOrg.is_personal ? "Personal" : activeOrg.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="[&>svg]:size-3" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-muted-foreground/80 font-medium max-w-[120px] truncate">
                      {activeSpace.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
            {parentPage && (
              <div className="flex items-center text-xs text-muted-foreground/50">
                <Link
                  to={`/motion/${parentPage.id}`}
                  className="hover:text-foreground transition-colors max-w-[100px] truncate flex items-center gap-1"
                >
                  <span className="shrink-0 flex items-center justify-center size-4">
                    {parentPage.icon?.startsWith("lucide:") ? (
                      (() => {
                        const iconName = parentPage.icon.split(":")[1];
                        const icons: Record<string, any> = { Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap };
                        const Icon = icons[iconName] || FileText;
                        return <Icon className="size-3.5" />;
                      })()
                    ) : (
                      parentPage.icon || "📄"
                    )}
                  </span>
                  <span className="truncate">{parentPage.title}</span>
                </Link>
                <ChevronRight className="size-3 mx-0.5" />
                <div className="text-foreground/70 max-w-[100px] truncate flex items-center gap-1">
                  <span className="shrink-0 flex items-center justify-center size-4">
                    {displayPage.icon?.startsWith("lucide:") ? (
                      (() => {
                        const iconName = displayPage.icon.split(":")[1];
                        const icons: Record<string, any> = { Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap };
                        const Icon = icons[iconName] || FileText;
                        return <Icon className="size-3.5" />;
                      })()
                    ) : (
                      displayPage.icon || "📄"
                    )}
                  </span>
                  <span className="truncate">{displayPage.title}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Save status */}
            <SaveIndicator status={saveStatus} />

            {/* Share button — opens panel anchored below */}
            {!isPageReadOnly && !isSharedPage && activeOrgId && activeSpaceId && (
              <Popover open={shareOpen || shareModalOpen} onOpenChange={(open) => { setShareOpen(open); setShareModalOpen(open); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <Share2 className="size-3.5" />
                    Share
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="p-0 rounded-xl shadow-lg border border-border bg-popover overflow-hidden w-auto"
                >
                  <MotionSharePanel
                    open={shareModalOpen}
                    pageId={pageId!}
                    pageTitle={displayPage.title}
                    orgId={activeOrgId}
                    spaceId={activeSpaceId}
                  />
                </PopoverContent>
              </Popover>
            )}

            {!isPageReadOnly && !isSharedPage && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground/50 hover:text-destructive transition-colors"
                onClick={handleDelete}
                disabled={softDelete.isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[300px] p-0 rounded-xl shadow-lg border border-border bg-popover overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex flex-col overflow-y-auto custom-scrollbar">
                  {/* Search bar */}
                  <div className="p-2 pb-0">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/50 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                      <Search className="size-3.5 text-muted-foreground" />
                      <input 
                        placeholder="Search actions..." 
                        className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground/60"
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Section 2 — Page Actions */}
                  {(matchesSearch("Copy page contents") || (matchesSearch("Move to Trash") && !isPageReadOnly && !isSharedPage)) && (
                    <>
                      <div className="py-1">
                        {matchesSearch("Copy page contents") && (
                          <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group" onClick={handleCopyContent}>
                            <div className="flex items-center gap-2.5">
                              <Copy className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Copy page contents</span>
                            </div>
                          </div>
                        )}
                        {matchesSearch("Move to Trash") && !isPageReadOnly && !isSharedPage && (
                          <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group" onClick={handleDelete}>
                            <div className="flex items-center gap-2.5">
                              <Trash2 className="size-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                              <span className="text-xs font-medium group-hover:text-destructive transition-colors">Move to Trash</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 3 — View & Layout Toggles */}
                  {!isPageReadOnly && (matchesSearch("Small text") || matchesSearch("Full width")) && (
                    <>
                      <div className="py-1">
                        {matchesSearch("Small text") && (
                          <div 
                            className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={toggleSmallText}
                          >
                            <div className="flex items-center gap-2.5">
                              <AArrowDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Small text</span>
                            </div>
                            <Switch size="sm" checked={displayPage.small_text || false} className="pointer-events-none" />
                          </div>
                        )}
                        {matchesSearch("Full width") && (
                          <div 
                            className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={toggleFullWidth}
                          >
                            <div className="flex items-center gap-2.5">
                              <MoveHorizontal className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Full width</span>
                            </div>
                            <Switch size="sm" checked={displayPage.full_width || false} className="pointer-events-none" />
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 4 — Page Settings */}
                  {(matchesSearch("Customize page") || matchesSearch("Lock page")) && (
                    <>
                      <div className="py-1">
                        {matchesSearch("Customize page") && (
                          <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group">
                            <div className="flex items-center gap-2.5">
                              <SlidersHorizontal className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Customize page</span>
                            </div>
                          </div>
                        )}
                        {matchesSearch("Lock page") && !isPageReadOnly && (
                          <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group" onClick={() => setIsLocked(!isLocked)}>
                            <div className="flex items-center gap-2.5">
                              <Lock className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Lock page</span>
                            </div>
                            <Switch size="sm" checked={isLocked} onCheckedChange={setIsLocked} />
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 5 — History & Actions */}
                  {matchesSearch("Undo") && (
                    <>
                      <div className="py-1">
                        {matchesSearch("Undo") && (
                          <div 
                            className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => {
                              if (pageEditor) {
                                pageEditor.commands.undo();
                              }
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <Undo2 className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Undo</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">Ctrl+Z</span>
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 6 — Advanced */}
                  {(matchesSearch("Updates & analytics") || matchesSearch("Version history")) && (
                    <>
                      <div className="py-1">
                        {matchesSearch("Updates & analytics") && (
                          <div
                            className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => handleToggleDrawer("updates")}
                          >
                            <div className="flex items-center gap-2.5">
                              <Clock className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Updates & analytics</span>
                            </div>
                          </div>
                        )}
                        {matchesSearch("Version history") && (
                          <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group">
                            <div className="flex items-center gap-2.5">
                              <History className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium">Version history</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 7 — Footer Meta Info */}
                  <div className="py-2 px-3 flex flex-col gap-0.5 bg-muted/20">
                    <span className="text-[10px] text-muted-foreground/70">
                      Word count: {pageEditor ? pageEditor.storage.characterCount.words() : 0} words
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      Last edited by {lastEditedMember?.name || lastEditedMember?.email || user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || "User"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {displayPage?.updated_at ? new Date(displayPage.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <div className={cn(
          "flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20 group/page",
          displayPage.small_text && "motion-page-small-text",
          displayPage.full_width && "motion-page-full-width"
        )}>
          <div className="w-full pt-0 relative">
            {displayPage.cover_image ? (
              <div
                ref={coverContainerRef}
                className="h-[220px] w-full relative group/cover"
              >
                <img
                  src={displayPage.cover_image}
                  alt="cover"
                  className={cn(
                    "size-full object-cover select-none transition-none",
                    isRepositioning ? "cursor-ns-resize" : ""
                  )}
                  style={{
                    objectPosition: `center ${isRepositioning ? draftPosition : (displayPage.cover_position ?? 50)}%`,
                  }}
                  draggable={false}
                  onMouseDown={isRepositioning ? (e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startPos = draftPosition;
                    const containerHeight = coverContainerRef.current?.getBoundingClientRect().height ?? 220;
                    // Each pixel of drag = (100 / containerHeight) % shift, inverted:
                    // dragging up (negative deltaY) → show lower part → increase %
                    // dragging down (positive deltaY) → show upper part → decrease %
                    const pxToPct = 100 / containerHeight;

                    const onMouseMove = (mv: MouseEvent) => {
                      const delta = mv.clientY - startY;
                      const next = Math.round(Math.max(0, Math.min(100, startPos + delta * pxToPct)));
                      setDraftPosition(next);
                    };

                    const onMouseUp = () => {
                      document.removeEventListener("mousemove", onMouseMove);
                      document.removeEventListener("mouseup", onMouseUp);
                    };

                    document.addEventListener("mousemove", onMouseMove);
                    document.addEventListener("mouseup", onMouseUp);
                  } : undefined}
                />

                {/* Normal buttons — hidden while repositioning */}
                {!isPageReadOnly && !isRepositioning && (
                  <div className="absolute bottom-4 right-6 opacity-0 group-hover/cover:opacity-100 transition-opacity flex gap-2">
                    <input
                      type="file"
                      ref={coverInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const result = reader.result as string;
                            if (pageId) {
                              useMotionStore.getState().updatePageLocally(pageId, { cover_image: result });
                              updatePage.mutate({ id: pageId, updates: { cover_image: result } });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium"
                      onClick={() => setShowCoverPicker(true)}
                    >
                      Change
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium"
                      onClick={() => {
                        setDraftPosition(displayPage.cover_position ?? 50);
                        setIsRepositioning(true);
                      }}
                    >
                      Reposition
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium"
                      onClick={() => {
                        if (pageId) {
                          useMotionStore.getState().updatePageLocally(pageId, { cover_image: null });
                          updatePage.mutate({ id: pageId, updates: { cover_image: null } });
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}

                {/* Reposition mode — overlay with hint + Save/Cancel */}
                {isRepositioning && (
                  <>
                    {/* Drag hint — center of image */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="bg-background/70 backdrop-blur-sm text-foreground/80 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
                        Drag image to reposition
                      </span>
                    </div>

                    {/* Save / Cancel — top-right, always visible */}
                    <div className="absolute top-3 right-4 flex gap-2 z-10">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-background/90 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium shadow-sm"
                        onClick={() => {
                          // Save: commit draft to DB and local store
                          if (pageId) {
                            useMotionStore.getState().updatePageLocally(pageId, { cover_position: draftPosition });
                            updatePage.mutate({ id: pageId, updates: { cover_position: draftPosition } });
                          }
                          setIsRepositioning(false);
                        }}
                      >
                        Save position
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-background/90 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium shadow-sm"
                        onClick={() => {
                          // Cancel: discard draft, revert to saved position
                          setDraftPosition(displayPage.cover_position ?? 50);
                          setIsRepositioning(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                <Dialog open={showCoverPicker} onOpenChange={setShowCoverPicker}>
                  <DialogContent showCloseButton={false} className="max-w-[540px] p-0 overflow-hidden bg-popover border-border shadow-2xl">
                    <DialogTitle className="sr-only">Choose Cover Image</DialogTitle>
                    <DialogHeader className="px-4 pt-3 pb-0 border-b border-border/50 relative flex-row items-center">
                      <div className="flex items-center gap-4 flex-1">
                        {['Gallery', 'Upload', 'Link', 'Unsplash'].map(tab => (
                          <button 
                            key={tab} 
                            onClick={() => setActiveCoverTab(tab as any)}
                            className={cn(
                              "pb-2 text-[13px] font-medium transition-colors border-b-2 relative -bottom-[1px]",
                              activeCoverTab === tab ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                            )}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                      <button 
                        className="pb-2 text-[13px] text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => {
                          if (pageId) updatePage.mutate({ id: pageId, updates: { cover_image: null } });
                          setShowCoverPicker(false);
                        }}
                      >
                        Remove
                      </button>
                    </DialogHeader>

                    <div className="p-4 max-h-[420px] overflow-y-auto custom-scrollbar">
                      {activeCoverTab === 'Gallery' && (
                        <div className="space-y-4">
                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Color & Gradient</span>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {['#eb5757', '#f2994a', '#f2c94c', '#27ae60', '#2d9cdb', '#9b51e0', '#4a4a4a', '#6b7280'].map(color => (
                                <button 
                                  key={color}
                                  className="h-14 rounded-md transition-transform hover:scale-[1.02] ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1" 
                                  style={{ backgroundColor: color }}
                                  onClick={() => {
                                    if (pageId) {
                                      useMotionStore.getState().updatePageLocally(pageId, { cover_image: color });
                                      updatePage.mutate({ id: pageId, updates: { cover_image: color } });
                                    }
                                    setShowCoverPicker(false);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Hudson River School</span>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {[
                                "https://www.notion.so/images/page-cover/hudsonRiverSchool_theOxbow.jpg",
                                "https://www.notion.so/images/page-cover/hudsonRiverSchool_springLandscape.jpg",
                                "https://www.notion.so/images/page-cover/hudsonRiverSchool_aegeanSea.jpg",
                                "https://www.notion.so/images/page-cover/hudsonRiverSchool_catskillEarlyAutumn.jpg",
                                "https://www.notion.so/images/page-cover/met_frederic_edwin_church_1871.jpg",
                                "https://www.notion.so/images/page-cover/rijksmuseum_avercamp_1620.jpg",
                              ].map(url => (
                                <button 
                                  key={url}
                                  className="h-16 rounded-md bg-cover bg-center transition-transform hover:scale-[1.02] ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1"
                                  style={{ backgroundImage: `url(${url})` }}
                                  onClick={() => {
                                    if (pageId) {
                                      useMotionStore.getState().updatePageLocally(pageId, { cover_image: url });
                                      updatePage.mutate({ id: pageId, updates: { cover_image: url } });
                                    }
                                    setShowCoverPicker(false);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Art & Illustration</span>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {[
                                "https://www.notion.so/images/page-cover/nationalMuseumOfAsianArt_sparrowsFeedingTheirYoung.jpg",
                                "https://www.notion.so/images/page-cover/usda_pear.png",
                                "https://www.notion.so/images/page-cover/met_vincent_van_gogh_ginoux.jpg",
                              ].map(url => (
                                <button 
                                  key={url}
                                  className="h-16 rounded-md bg-cover bg-center transition-transform hover:scale-[1.02] ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1"
                                  style={{ backgroundImage: `url(${url})` }}
                                  onClick={() => {
                                    if (pageId) {
                                      useMotionStore.getState().updatePageLocally(pageId, { cover_image: url });
                                      updatePage.mutate({ id: pageId, updates: { cover_image: url } });
                                    }
                                    setShowCoverPicker(false);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="h-20 w-full bg-background" />
            )}

            {/* Icon — straddles the cover/content boundary */}
            {(displayPage.icon || showEmojiPicker) && (
              <div className="max-w-[900px] mx-auto w-full px-12 lg:px-16 motion-page-container">
                <div className="relative group/icon pl-4" style={{ marginTop: displayPage.cover_image ? '-40px' : '16px', marginBottom: '12px', width: 'fit-content' }}>
                    <div
                      className={cn(
                        "text-[78px] leading-none select-none flex items-center justify-center shrink-0",
                        isPageReadOnly ? "cursor-default" : "cursor-pointer"
                      )}
                      onClick={() => {
                        if (!isPageReadOnly) {
                          setShowEmojiPicker(!showEmojiPicker);
                        }
                      }}
                    >
                      {displayPage.icon?.startsWith("data:image") ? (
                        <img src={displayPage.icon} alt="icon" className="size-full object-cover rounded-xl" />
                      ) : displayPage.icon?.startsWith("lucide:") ? (
                        (() => {
                          const iconName = displayPage.icon!.split(":")[1];
                          const icons: Record<string, any> = { Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap };
                          const Icon = icons[iconName] || FileText;
                          return <Icon className="size-16 text-foreground/80" />;
                        })()
                      ) : displayPage.icon ? (
                        displayPage.icon
                      ) : (
                        <Smile className="size-16 text-muted-foreground/30" />
                      )}
                    </div>
                    <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <DialogContent showCloseButton={false} className="max-w-[360px] p-0 overflow-hidden bg-popover border-border shadow-2xl">
                        <DialogTitle className="sr-only">Choose Icon</DialogTitle>
                        <DialogHeader className="px-4 pt-3 pb-0 border-b border-border/50 flex-row items-center">
                          <div className="flex items-center gap-4 flex-1">
                            {['Emoji', 'Icons', 'Upload'].map(tab => (
                              <button 
                                key={tab} 
                                onClick={() => setActiveEmojiTab(tab as any)}
                                className={cn(
                                  "pb-2 text-[13px] font-medium transition-colors border-b-2 relative -bottom-[1px]",
                                  activeEmojiTab === tab ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                                )}
                              >
                                {tab}
                              </button>
                            ))}
                          </div>
                          <button 
                            className="pb-2 text-[13px] text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => {
                              if (pageId) {
                                useMotionStore.getState().updatePageLocally(pageId, { icon: null });
                                updatePage.mutate({ id: pageId, updates: { icon: null } });
                              }
                              setShowEmojiPicker(false);
                            }}
                          >
                            Remove
                          </button>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden flex flex-col min-h-[360px]">
                          {activeEmojiTab === 'Emoji' && (
                            <div className="p-3 flex flex-col h-full">
                              <div className="flex gap-2 items-center bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border/50 mb-3 focus-within:border-primary/50 transition-colors">
                                <Search className="size-3.5 text-muted-foreground" />
                                <input 
                                  placeholder="Filter..." 
                                  className="bg-transparent border-none outline-none text-[13px] w-full text-foreground placeholder:text-muted-foreground/50"
                                  value={emojiSearch}
                                  onChange={(e) => setEmojiSearch(e.target.value)}
                                />
                                <div className="flex items-center gap-1.5 border-l border-border/10 pl-2">
                                  <button 
                                    className="p-0.5 hover:bg-accent rounded text-muted-foreground transition-colors"
                                    onClick={() => {
                                      if (activeEmojiTab === 'Emoji') {
                                        const icons = ["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚"];
                                        const random = icons[Math.floor(Math.random() * icons.length)];
                                        if (pageId) updatePage.mutate({ id: pageId, updates: { icon: random } });
                                      } else if (activeEmojiTab === 'Icons') {
                                        const iconNames = ['Plane', 'Heart', 'Star', 'Cloud', 'Moon', 'Sun', 'Bell', 'Camera', 'Gift', 'Coffee', 'Music', 'Code', 'Terminal', 'Database', 'Shield', 'Layout', 'Settings', 'User', 'Users', 'Mail', 'Map', 'Flag', 'Bookmark', 'Calendar', 'CheckCircle', 'HelpCircle', 'Info', 'AlertTriangle', 'AlertCircle', 'XCircle', 'Clock', 'Zap'];
                                        const random = iconNames[Math.floor(Math.random() * iconNames.length)];
                                        if (pageId) updatePage.mutate({ id: pageId, updates: { icon: `lucide:${random}` } });
                                      }
                                    }}
                                    title="Random"
                                  >
                                    <Sparkles className="size-3" />
                                  </button>
                                  <span className="text-border text-xs font-light">|</span>
                                  <button className="p-0.5 hover:bg-accent rounded text-muted-foreground transition-colors">
                                    <Smile className="size-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 gap-1 overflow-y-auto custom-scrollbar pr-1">
                                {["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚", "📔", "📕", "📗", "📘", "📙", "💼", "📁", "📂", "📅", "📆", "🗓️", "📊", "📈", "📉", "🔍", "🕵️", "🏠", "🏡", "🏘️", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏰", "🏯", "🗼", "🗽", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌆", "🌇", "🌉", "🌌", "🎠", "🎡", "🎢"].filter(e => e.includes(emojiSearch) || emojiSearch === "").map(emoji => (
                                  <button
                                    key={emoji}
                                    className="size-8 flex items-center justify-center hover:bg-muted rounded-md transition-colors text-xl"
                                    onClick={() => {
                                      if (pageId) {
                                        useMotionStore.getState().updatePageLocally(pageId, { icon: emoji });
                                        updatePage.mutate({ id: pageId, updates: { icon: emoji } });
                                      }
                                      setShowEmojiPicker(false);
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeEmojiTab === 'Icons' && (
                            <div className="p-3 flex flex-col h-full">
                              <div className="flex gap-2 items-center bg-muted/30 rounded-lg px-2.5 py-1.5 border border-border/50 mb-3 focus-within:border-primary/50 transition-colors">
                                <Search className="size-3.5 text-muted-foreground" />
                                <input
                                  placeholder="Filter..."
                                  className="bg-transparent border-none outline-none text-[13px] w-full"
                                  value={emojiSearch}
                                  onChange={(e) => setEmojiSearch(e.target.value)}
                                />
                              </div>
                              <div className="grid grid-cols-8 gap-1 overflow-y-auto custom-scrollbar pr-1">
                                {[
                                  { name: 'Plane', icon: Plane }, { name: 'Heart', icon: Heart }, { name: 'Star', icon: Star }, { name: 'Cloud', icon: Cloud }, { name: 'Moon', icon: Moon }, { name: 'Sun', icon: Sun }, { name: 'Bell', icon: Bell }, { name: 'Camera', icon: Camera }, { name: 'Gift', icon: Gift }, { name: 'Coffee', icon: Coffee }, { name: 'Music', icon: Music }, { name: 'Code', icon: Code }, { name: 'Terminal', icon: Terminal }, { name: 'Database', icon: Database }, { name: 'Shield', icon: Shield }, { name: 'Layout', icon: Layout }, { name: 'Settings', icon: Settings }, { name: 'User', icon: User }, { name: 'Users', icon: Users }, { name: 'Mail', icon: Mail }, { name: 'Map', icon: Map }, { name: 'Flag', icon: Flag }, { name: 'Bookmark', icon: Bookmark }, { name: 'Calendar', icon: Calendar }, { name: 'CheckCircle', icon: CheckCircle }, { name: 'HelpCircle', icon: HelpCircle }, { name: 'Info', icon: Info }, { name: 'AlertTriangle', icon: AlertTriangle }, { name: 'AlertCircle', icon: AlertCircle }, { name: 'XCircle', icon: XCircle }, { name: 'Clock', icon: Clock }, { name: 'Zap', icon: Zap }
                                ].map((item, idx) => (
                                  <button
                                    key={idx}
                                    className="size-8 flex items-center justify-center hover:bg-muted rounded-md transition-colors"
                                    onClick={() => {
                                      if (pageId) {
                                        useMotionStore.getState().updatePageLocally(pageId, { icon: `lucide:${item.name}` });
                                        updatePage.mutate({ id: pageId, updates: { icon: `lucide:${item.name}` } });
                                      }
                                      setShowEmojiPicker(false);
                                    }}
                                  >
                                    <item.icon className="size-4 text-foreground/70" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeEmojiTab === 'Upload' && (
                            <div className="p-8 flex flex-col h-full items-center justify-center text-center gap-6">
                              <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (pageId) updatePage.mutate({ id: pageId, updates: { icon: reader.result as string } });
                                      setShowEmojiPicker(false);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <div
                                className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <div className="size-10 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <ImageLucide className="size-5 text-muted-foreground" />
                                </div>
                                <span className="text-[13.5px] font-medium text-foreground/70">Upload an image</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[12px] text-muted-foreground/60 font-medium">or Ctrl+V to paste an image or link</span>
                              </div>
                              <div className="mt-auto w-full flex items-center justify-between pt-4 border-t border-border/40">
                                <button
                                  className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => setShowEmojiPicker(false)}
                                >
                                  Cancel
                                </button>
                                <Button
                                  size="sm"
                                  className="h-8 px-4 text-[13px] font-medium bg-primary/20 text-primary hover:bg-primary/30 border-none"
                                  onClick={() => setShowEmojiPicker(false)}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
            )}

            <main className="max-w-[900px] mx-auto w-full relative px-12 lg:px-16 motion-page-container">
              <div className="group/title-area">
                {!isPageReadOnly && (
                  <div className={cn(
                    "flex items-center gap-3 text-muted-foreground/40 text-[13px] font-medium transition-all duration-300 px-4",
                    "mt-3 mb-2",
                    "opacity-0 group-hover/title-area:opacity-100"
                  )}>
                    {!displayPage.icon && (
                      <button
                        className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                        onClick={() => {
                          setShowEmojiPicker(true);
                        }}
                      >
                        Add icon
                      </button>
                    )}
                    {!displayPage.cover_image && (
                      <button
                        className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                        onClick={() => {
                          const defaultCover = "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1600&auto=format&fit=crop";
                          if (pageId) {
                            useMotionStore.getState().updatePageLocally(pageId, { cover_image: defaultCover });
                            updatePage.mutate({ id: pageId, updates: { cover_image: defaultCover } });
                          }
                        }}
                      >
                        Add cover
                      </button>
                    )}
                    <button className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5">
                      Add comment
                    </button>
                  </div>
                )}

                {/* Title */}
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    pageEditor?.commands?.focus?.("start");
                  }}
                  onBlur={handleTitleBlur}
                  readOnly={isPageReadOnly}
                  className={cn(
                    "w-full bg-transparent text-[44px] px-4 leading-[1.1] font-bold tracking-tight text-foreground/90 outline-none placeholder:text-foreground/25",
                    isPageReadOnly && "pointer-events-none"
                  )}
                  placeholder="Untitled"
                />
              </div>

              {/* Editor */}
              <div className="pt-0">
                {editorContent ? (
                  <SimpleEditor
                    key={editorKey}
                    content={editorContent}
                    onContentChange={handleContentChange}
                    onReady={(editor) => setPageEditor(editor)}
                    onAddSubpage={handleAddSubpage}
                    onDeleteSubpage={handleDeleteSubpage}
                    onRestoreSubpage={handleRestoreSubpage}
                  />
                ) : (
                  <div className="px-4 py-8 text-muted-foreground/40 text-sm animate-pulse">
                    Loading content…
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar-page::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar-page::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
          .custom-scrollbar-page:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }

          /* Small Text Toggle Styles */
          .motion-page-small-text .tiptap.ProseMirror.simple-editor {
            font-size: 14px !important;
            line-height: 1.5 !important;
          }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h1,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="1"] { font-size: 1.9rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h2,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="2"] { font-size: 1.45rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h3,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="3"] { font-size: 1.05rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h4,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="4"] { font-size: 0.9rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor p,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor li,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor td,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor th,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor code,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor blockquote {
            font-size: 14px !important;
          }

          /* Full Width Toggle Styles */
          .motion-page-full-width .motion-page-container {
            max-width: none !important;
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
          }
          .motion-page-full-width .simple-editor-content {
            max-width: none !important;
          }
          @media (min-width: 1024px) {
            .motion-page-full-width .motion-page-container {
              padding-left: 3rem !important;
              padding-right: 3rem !important;
            }
          }
        `,
        }}
      />

    </div>
  );
}
