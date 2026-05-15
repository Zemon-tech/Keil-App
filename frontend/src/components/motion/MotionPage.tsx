import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Menu, MoreHorizontal, Trash2, ChevronRight, Share2 } from "lucide-react";
import { MotionShareModal } from "./MotionShareModal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MotionSidebar } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { useAppContext } from "@/contexts/AppContext";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import {
  useMotionPage,
  useUpdateMotionPage,
  useSoftDeleteMotionPage,
  useCreateMotionPage,
} from "@/hooks/api/useMotionPages";
import type { JSONContent } from "@tiptap/core";

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
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { activeOrgId, activeSpaceId, mode } = useAppContext();
  const { sidebarOpen, setSidebarOpen, getPageById, hydratePages, setDirty, clearDirty } =
    useMotionStore();

  // Stable ref so hydratePages is never a useEffect dependency
  const hydratePagesRef = useRef(hydratePages);
  hydratePagesRef.current = hydratePages;

  // ── API hooks ───────────────────────────────────────────────────────────────
  const { data: serverPage, isLoading } = useMotionPage(
    activeOrgId,
    activeSpaceId,
    pageId ?? null
  );
  const updatePage = useUpdateMotionPage(activeOrgId, activeSpaceId);
  const softDelete = useSoftDeleteMotionPage(activeOrgId, activeSpaceId);
  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);

  // Hydrate store when server data arrives — ref avoids infinite loop
  useEffect(() => {
    if (serverPage) {
      hydratePagesRef.current([serverPage]);
    }
  }, [serverPage]);

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

  // ── Redirect if page not found after load ───────────────────────────────────
  useEffect(() => {
    if (!isLoading && !serverPage && !page) {
      navigate("/motion", { replace: true });
    }
  }, [isLoading, serverPage, page, navigate]);

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
    try {
      await updatePage.mutateAsync({ id: pageId, updates: { content } });
      setSaveStatus("saved");
      clearDirty(pageId);
      // Reset to idle after a short delay so "Saved" doesn't linger
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      // Retry once after 3s
      setTimeout(() => {
        if (pendingContent.current === null) {
          pendingContent.current = content;
          flushSave();
        }
      }, 3000);
    }
  }, [pageId, updatePage, clearDirty]);

  const handleContentChange = useCallback(
    (json: JSONContent) => {
      if (!pageId) return;
      pendingContent.current = json;
      setDirty(pageId);
      setSaveStatus("saving");

      // Reset debounce timer
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushSave, DEBOUNCE_MS);
    },
    [pageId, setDirty, flushSave]
  );

  // Flush on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      // Fire-and-forget flush — we can't await in cleanup
      if (pendingContent.current && pageId) {
        updatePage.mutate({
          id: pageId,
          updates: { content: pendingContent.current },
        });
        pendingContent.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // ── Title save (on blur) ────────────────────────────────────────────────────
  const handleTitleBlur = () => {
    if (!pageId) return;
    const trimmed = titleDraft.trim() || "Untitled";
    if (trimmed !== page?.title) {
      updatePage.mutate({ id: pageId, updates: { title: trimmed } });
    }
  };

  // ── Add subpage ─────────────────────────────────────────────────────────────
  const handleAddSubpage = async () => {
    if (!pageId) return;
    const newPage = await createPage.mutateAsync({ parent_id: pageId });
    navigate(`/motion/${newPage.id}`);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!pageId || !page) return;
    if (confirm("Are you sure you want to delete this page?")) {
      softDelete.mutate({ id: pageId, title: page.title });
      navigate("/motion");
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (mode !== "organisation" || !activeOrgId || !activeSpaceId) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">
          Select an organisation and space to use Motion.
        </p>
      </div>
    );
  }

  if (isLoading || (!page && !serverPage)) {
    return (
      <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative" />
    );
  }

  const displayPage = page ?? serverPage!;

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
        <header className="flex items-center justify-between px-2 py-1 z-40 shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="size-4" />
            </Button>
            {parentPage && (
              <div className="flex items-center text-xs text-muted-foreground/50">
                <Link
                  to={`/motion/${parentPage.id}`}
                  className="hover:text-foreground transition-colors max-w-[100px] truncate"
                >
                  {parentPage.title}
                </Link>
                <ChevronRight className="size-3 mx-0.5" />
                <span className="text-foreground/70 max-w-[100px] truncate">
                  {displayPage.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Save status */}
            <SaveIndicator status={saveStatus} />

            {/* Share button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={() => setShareModalOpen(true)}
            >
              <Share2 className="size-3.5" />
              Share
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-destructive transition-colors"
              onClick={handleDelete}
              disabled={softDelete.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20">
          <div className="w-full pt-0">
            {/* Cover image */}
            <div className="h-[240px] w-full overflow-hidden bg-muted">
              <img
                src={
                  displayPage.cover_image ??
                  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1600&auto=format&fit=crop"
                }
                alt="cover"
                className="h-full w-full object-cover opacity-80"
              />
            </div>

            <main className="max-w-[900px] mx-auto w-full pt-6 px-6">
              <div className="flex items-center gap-4 text-muted-foreground/60 text-sm mb-4">
                <button className="hover:text-foreground/70 transition-colors">
                  Add icon
                </button>
                <button className="hover:text-foreground/70 transition-colors">
                  Add comment
                </button>
              </div>

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
                className="w-full bg-transparent text-[44px] leading-[1.1] font-bold tracking-tight text-foreground/90 outline-none placeholder:text-foreground/25"
                placeholder="Untitled"
              />

              {/* Editor */}
              <div className="pt-6">
                <SimpleEditor
                  key={pageId}
                  content={displayPage.content}
                  onContentChange={handleContentChange}
                  onReady={(editor) => setPageEditor(editor)}
                  onAddSubpage={handleAddSubpage}
                />
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
        `,
        }}
      />

      {/* Share modal — rendered outside the scrollable area */}
      {activeOrgId && activeSpaceId && (
        <MotionShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          pageId={pageId!}
          pageTitle={displayPage.title}
          orgId={activeOrgId}
          spaceId={activeSpaceId}
        />
      )}
    </div>
  );
}
