import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";
import api from "@/lib/api";
import {
  Menu, MoreHorizontal, Trash2, ChevronRight, Share2, Search, Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap, Sparkles, FileText, Image as ImageLucide, Smile, Copy, AArrowDown, MoveHorizontal, Lock, Undo2, Loader2, RefreshCw, ArrowUpRight, Link2Off, Eye, Pen
} from "lucide-react";
import {
  useNotionStatus,
  useExportNotionPage,
  useSyncNotionPage,
  useUnlinkNotionPage,
} from "@/hooks/api/useNotion";
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
import { Spinner } from "@/components/ui/spinner";
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
import { useQueryClient } from "@tanstack/react-query";
import {
  useMotionPage,
  useUpdateMotionPage,
  useSoftDeleteMotionPage,
  useCreateMotionPage,
  useMotionSocketListeners,
  useRestoreMotionPage,
  useCachedPageById,
  motionPageKeys,
  type MotionPageDTO,
} from "@/hooks/api/useMotionPages";
import { useRecordPageView } from "@/hooks/api/useMotionAnalytics";

const COVER_CATEGORIES = [
  {
    title: "Color & Gradient",
    type: "colors" as const,
    items: ['#eb5757', '#f2994a', '#f2c94c', '#27ae60', '#2d9cdb', '#9b51e0', '#4a4a4a', '#6b7280']
  },
  {
    title: "Hudson River School",
    type: "images" as const,
    items: [
      "https://www.notion.so/images/page-cover/hudsonRiverSchool_theOxbow.jpg",
      "https://www.notion.so/images/page-cover/hudsonRiverSchool_springLandscape.jpg",
      "https://www.notion.so/images/page-cover/hudsonRiverSchool_aegeanSea.jpg",
      "https://www.notion.so/images/page-cover/hudsonRiverSchool_catskillEarlyAutumn.jpg",
      "https://app.notion.com/images/page-cover/hudsonRiverSchool_passingOffOfTheStorm.jpg"
    ]
  },
  {
    title: "Patterns",
    type: "images" as const,
    items: [
      "https://app.notion.com/images/page-cover/met_william_morris_1877_willow.jpg",
      "https://app.notion.com/images/page-cover/met_william_morris_1875.jpg",
      "https://app.notion.com/images/page-cover/met_william_morris_1878.jpg",
      "https://app.notion.com/images/page-cover/met_silk_kashan_carpet.jpg"
    ]
  },
  {
    title: "Rijksmuseum",
    type: "images" as const,
    items: [
      "https://app.notion.com/images/page-cover/rijksmuseum_vermeer_the_milkmaid.jpg",
      "https://app.notion.com/images/page-cover/rijksmuseum_jansz_1649.jpg",
      "https://app.notion.com/images/page-cover/rijksmuseum_rembrandt_1642.jpg",
      "https://app.notion.com/images/page-cover/rijksmuseum_jansz_1636.jpg",
      "https://app.notion.com/images/page-cover/rijksmuseum_jan_lievens_1627.jpg",
      "https://app.notion.com/images/page-cover/rijksmuseum_claesz_1628.jpg"
    ]
  },
  {
    title: "The Metropolitan Museum of Art",
    type: "images" as const,
    items: [
      "https://app.notion.com/images/page-cover/met_vincent_van_gogh_ginoux.jpg",
      "https://app.notion.com/images/page-cover/met_winslow_homer_maine_coast.jpg",
      "https://app.notion.com/images/page-cover/met_frederic_edwin_church_1871.jpg",
      "https://app.notion.com/images/page-cover/met_joseph_hidley_1870.jpg",
      "https://app.notion.com/images/page-cover/met_jules_tavernier_1878.jpg",
      "https://app.notion.com/images/page-cover/met_henry_lerolle_1885.jpg",
      "https://app.notion.com/images/page-cover/met_georges_seurat_1884.jpg",
      "https://app.notion.com/images/page-cover/met_john_singer_sargent_morocco.jpg",
      "https://app.notion.com/images/page-cover/met_paul_signac.jpg",
      "https://app.notion.com/images/page-cover/met_vincent_van_gogh_oleanders.jpg",
      "https://app.notion.com/images/page-cover/met_emanuel_leutze.jpg",
      "https://app.notion.com/images/page-cover/met_fitz_henry_lane.jpg",
      "https://app.notion.com/images/page-cover/met_gerome_1890.jpg",
      "https://app.notion.com/images/page-cover/met_camille_pissarro_1896.jpg",
      "https://app.notion.com/images/page-cover/met_arnold_bocklin_1880.jpg",
      "https://app.notion.com/images/page-cover/met_canaletto_1720.jpg",
      "https://app.notion.com/images/page-cover/met_william_turner_1835.jpg",
      "https://app.notion.com/images/page-cover/met_klimt_1912.jpg",
      "https://app.notion.com/images/page-cover/met_bruegel_1565.jpg",
      "https://app.notion.com/images/page-cover/met_goya_1789.jpg",
      "https://app.notion.com/images/page-cover/met_the_unicorn_in_captivity.jpg",
      "https://app.notion.com/images/page-cover/met_henri_rousseau_1907.jpg",
      "https://app.notion.com/images/page-cover/met_horace_pippin.jpg"
    ]
  },
  {
    title: "Woodcuts",
    type: "images" as const,
    items: [
      "https://app.notion.com/images/page-cover/woodcuts_1.jpg",
      "https://app.notion.com/images/page-cover/woodcuts_5.jpg",
      "https://app.notion.com/images/page-cover/woodcuts_9.jpg",
      "https://app.notion.com/images/page-cover/woodcuts_15.jpg",
      "https://app.notion.com/images/page-cover/woodcuts_16.jpg",
      "https://app.notion.com/images/page-cover/woodcuts_11.jpg"
    ]
  },
  {
    title: "Art & Illustration",
    type: "images" as const,
    items: [
      "https://www.notion.so/images/page-cover/nationalMuseumOfAsianArt_sparrowsFeedingTheirYoung.jpg",
      "https://www.notion.so/images/page-cover/usda_pear.png",
      "https://app.notion.com/images/page-cover/usda_cherries.png",
      "https://app.notion.com/images/page-cover/usda_apple.png",
      "https://app.notion.com/images/page-cover/usda_oranges.png"
    ]
  }
];

const ALL_COVER_IMAGES = COVER_CATEGORIES
  .filter(cat => cat.type === "images")
  .flatMap(cat => cat.items);
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

  // Notion integration hooks & state
  const { data: notionStatus } = useNotionStatus();
  const syncNotion = useSyncNotionPage();
  const exportNotion = useExportNotionPage();
  const unlinkNotion = useUnlinkNotionPage();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'create' | 'append'>('create');
  const [parentNotionPageId, setParentNotionPageId] = useState("");
  const [targetNotionPageId, setTargetNotionPageId] = useState("");

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

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [unsplashSearch, setUnsplashSearch] = useState("");

  useEffect(() => {
    if (!showCoverPicker) {
      setUploadProgress(null);
      setUploadStatus('idle');
      setUploadError(null);
      setLinkUrl("");
      setLinkError(null);
    }
  }, [showCoverPicker]);


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
    setDirty,
    clearDirty,
    drawerOpen,
    setDrawerOpen,
    drawerTab,
    setDrawerTab,
    shareOpen,
    setShareOpen,
    setLastOpenedPageId,
    addRecentlyOpenedPageId,
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
      addRecentlyOpenedPageId(activeOrgId, activeSpaceId, pageId);
    }
  }, [pageId, activeOrgId, activeSpaceId, setLastOpenedPageId, addRecentlyOpenedPageId]);
  // Stable ref so upsertPages is never a useEffect dependency
  const queryClient = useQueryClient();

  // ── API hooks ───────────────────────────────────────────────────────────────
  const { data: serverPage, isFetched } = useMotionPage(
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

  const [draftContent, setDraftContent] = useState<JSONContent | null>(null);

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
      setDraftContent(draft);
      setDirty(pageId);
      toast.success("Unsaved changes recovered from a local draft.", {
        description: "We found a newer unsaved draft of this page.",
      });
      // Force SimpleEditor to re-mount with the draft content by updating the key
      setEditorKey(`${pageId}-draft-${Date.now()}`);
    } else {
      setDraftContent(null);
      setEditorKey(pageId);
    }
  }, [pageId, setDirty]);

  // ── Derived display page and parent page ───────────────────────────────────
  const page = useCachedPageById(pageId);
  const displayPage = page ?? serverPage ?? null;
  const parentPage = useCachedPageById(displayPage?.parent_id);

  // Content specifically for the editor — only trust sources that include content.
  const editorContent = draftContent ?? serverPage?.content ?? undefined;

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
    if (isFetched && !serverPage && !page) {
      // Clear the invalid lastOpenedPageId so we don't end up in an infinite redirect loop
      if (activeOrgId && activeSpaceId) {
        setLastOpenedPageId(activeOrgId, activeSpaceId, null);
      }
      navigate("/motion", { replace: true });
    }
  }, [isFetched, serverPage, page, navigate, activeOrgId, activeSpaceId, setLastOpenedPageId]);

  // ── Title draft ─────────────────────────────────────────────────────────────
  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    if (displayPage) {
      setTitleDraft(displayPage.title);
    }
  }, [pageId, displayPage?.title]);

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
    if (trimmed !== displayPage?.title) {
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
      const allPages = queryClient.getQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(activeOrgId ?? "", activeSpaceId ?? "")
      );
      const pageRecord = allPages?.find((p) => p.id === subpageId);
      const title = pageRecord?.title ?? "Untitled";
      softDelete.mutate({ id: subpageId, title });
    },
    [queryClient, activeOrgId, activeSpaceId, softDelete]
  );

  const handleRestoreSubpage = useCallback(
    (subpageId: string) => {
      restorePage.mutate(subpageId);
    },
    [restorePage]
  );

  const handleUploadCover = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image file must be under 5MB.");
      setUploadStatus("error");
      return;
    }

    if (!pageId) {
      setUploadError("Page ID is missing.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadError(null);

    try {
      const res = await api.post("v1/s3-upload/motion/asset", {
        pageId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream"
      });

      const { uploadUrl, publicUrl } = res.data.data;

      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(percent);
          }
        }
      });

      await updatePage.mutateAsync({
        id: pageId,
        updates: { cover_image: publicUrl }
      });

      setUploadStatus("success");
      setUploadProgress(null);
      setShowCoverPicker(false);
    } catch (err: any) {
      console.error("Cover image upload failed:", err);
      setUploadStatus("error");
      setUploadError(err.response?.data?.message || err.message || "Failed to upload image. Please try again.");
    }
  };

  const handleApplyLink = () => {
    const urlRegex = /^https?:\/\/.+/i;
    if (!urlRegex.test(linkUrl)) {
      setLinkError("Please enter a valid HTTP/HTTPS link.");
      return;
    }

    if (!pageId) {
      setLinkError("Page ID is missing.");
      return;
    }

    setLinkError(null);
    updatePage.mutate({
      id: pageId,
      updates: { cover_image: linkUrl }
    }, {
      onSuccess: () => {
        setShowCoverPicker(false);
        setLinkUrl("");
      },
      onError: (err: any) => {
        setLinkError(err.response?.data?.message || err.message || "Failed to update cover image.");
      }
    });
  };


  const toggleSmallText = () => {
    if (!pageId || !displayPage) return;
    const nextValue = !displayPage.small_text;
    updatePage.mutate({ id: pageId, updates: { small_text: nextValue } });
  };

  const toggleFullWidth = () => {
    if (!pageId || !displayPage) return;
    const nextValue = !displayPage.full_width;
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
      <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative">
        {/* Render sidebar so it remains accessible while page data is fetching */}
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
            sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
          )}
        >
          <MotionSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Centered workspace spinner */}
        <div className="flex-1 flex items-center justify-center h-full">
          <Spinner className="size-8 text-muted-foreground/50" />
        </div>
      </div>
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
                  {matchesSearch("Lock page") && !isPageReadOnly && (
                    <>
                      <div className="py-1">
                        <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group" onClick={() => setIsLocked(!isLocked)}>
                          <div className="flex items-center gap-2.5">
                            <Lock className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-xs font-medium">Lock page</span>
                          </div>
                          <Switch size="sm" checked={isLocked} onCheckedChange={setIsLocked} />
                        </div>
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

                  {/* Section 5.5 — Notion Integration */}
                  {!isPageReadOnly && (matchesSearch("Notion") || matchesSearch("Sync") || matchesSearch("Export")) && (
                    <>
                      <div className="py-1">
                        {notionStatus?.connected ? (
                          displayPage.notion_page_id ? (
                            <div className="flex flex-col">
                              {/* Sync Item */}
                              <div
                                className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                                onClick={() => syncNotion.mutate({ motionPageId: pageId! })}
                              >
                                <div className="flex items-center gap-2.5">
                                  <RefreshCw className={cn("size-4 text-muted-foreground group-hover:text-foreground transition-colors", syncNotion.isPending && "animate-spin")} />
                                  <div className="flex flex-col text-left">
                                    <span className="text-xs font-medium text-foreground">Sync with Notion</span>
                                    {displayPage.notion_last_synced_at && (
                                      <span className="text-[9px] text-muted-foreground font-normal">
                                        Last: {new Date(displayPage.notion_last_synced_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {syncNotion.isPending ? (
                                  <Loader2 className="size-3 text-muted-foreground animate-spin" />
                                ) : displayPage.notion_last_synced_at ? (
                                  <span className="text-[9px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                    Synced
                                  </span>
                                ) : null}
                              </div>

                              {/* Open Item */}
                              <a
                                href={`https://notion.so/${displayPage.notion_page_id.replace(/-/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                              >
                                <div className="flex items-center gap-2.5">
                                  <Share2 className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                  <span className="text-xs font-medium text-foreground">Open in Notion</span>
                                </div>
                                <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </a>

                              {/* Unlink Item */}
                              <div
                                className="flex items-center justify-between px-3 py-1.5 hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors group text-muted-foreground"
                                onClick={() => {
                                  if (confirm("Unlink this page from Notion? This will allow you to export it to another workspace.")) {
                                    unlinkNotion.mutate({ motionPageId: pageId! });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Link2Off className="size-4 group-hover:text-destructive transition-colors" />
                                  <span className="text-xs font-medium group-hover:text-destructive">Unlink from Notion</span>
                                </div>
                                {unlinkNotion.isPending && (
                                  <Loader2 className="size-3 text-destructive animate-spin" />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                              onClick={() => setExportDialogOpen(true)}
                            >
                              <Share2 className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs font-medium text-foreground">Export to Notion</span>
                            </div>
                          )
                        ) : (
                          <div className="px-3 py-2 text-center space-y-1 bg-muted/10 rounded-lg mx-2 my-1 border border-border/30">
                            <p className="text-[10px] font-semibold text-muted-foreground">Notion Integration</p>
                            <p className="text-[9px] text-muted-foreground/60 leading-normal">
                              Connect Notion in settings to sync pages.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 6 — Advanced */}
                  {matchesSearch("Updates & analytics") && (
                    <>
                      <div className="py-1">
                        <div
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group"
                          onClick={() => handleToggleDrawer("updates")}
                        >
                          <div className="flex items-center gap-2.5">
                            <Clock className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-xs font-medium">Updates & analytics</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-px bg-border/50 w-full" />
                    </>
                  )}

                  {/* Section 7 — Footer Meta Info */}
                  <div className="py-2 px-3 flex flex-col gap-0.5 bg-muted/20">
                    <span className="text-[10px] text-muted-foreground/70">
                      Word count: {pageEditor?.storage?.characterCount?.words ? pageEditor.storage.characterCount.words() : 0} words
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
                          handleUploadCover(file);
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
                          {COVER_CATEGORIES.map((category) => (
                            <div key={category.title}>
                              <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                                {category.title}
                              </span>
                              {category.type === "colors" ? (
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                  {category.items.map((color) => (
                                    <button
                                      key={color}
                                      className="h-14 rounded-md transition-transform hover:scale-[1.02] ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1 cursor-pointer"
                                      style={{ backgroundColor: color }}
                                      onClick={() => {
                                        if (pageId) {
                                          updatePage.mutate({ id: pageId, updates: { cover_image: color } });
                                        }
                                        setShowCoverPicker(false);
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                  {category.items.map((url) => (
                                    <button
                                      key={url}
                                      className="h-16 rounded-md bg-cover bg-center transition-transform hover:scale-[1.02] ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1 cursor-pointer"
                                      style={{ backgroundImage: `url(${url})` }}
                                      onClick={() => {
                                        if (pageId) {
                                          updatePage.mutate({ id: pageId, updates: { cover_image: url } });
                                        }
                                        setShowCoverPicker(false);
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {activeCoverTab === 'Upload' && (
                        <div className="space-y-4 py-2">
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file) handleUploadCover(file);
                            }}
                            className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition-colors cursor-pointer text-center"
                            onClick={() => {
                              const el = document.createElement("input");
                              el.type = "file";
                              el.accept = "image/*";
                              el.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleUploadCover(file);
                              };
                              el.click();
                            }}
                          >
                            <Camera className="size-8 text-muted-foreground/60" />
                            <div className="text-sm font-medium">Drag & drop an image, or click to upload</div>
                            <div className="text-xs text-muted-foreground">Images up to 5MB are supported</div>
                          </div>

                          {uploadStatus === 'uploading' && uploadProgress !== null && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-medium">
                                <span>Uploading...</span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-150"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {uploadStatus === 'error' && uploadError && (
                            <div className="text-xs text-destructive flex items-center gap-1.5 justify-center">
                              <AlertTriangle className="size-3.5" />
                              {uploadError}
                            </div>
                          )}
                        </div>
                      )}

                      {activeCoverTab === 'Link' && (
                        <div className="space-y-4 py-2">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                              Link to an image
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Paste an image URL (https://...)"
                                value={linkUrl}
                                onChange={(e) => {
                                  setLinkUrl(e.target.value);
                                  setLinkError(null);
                                }}
                                className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleApplyLink();
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={handleApplyLink}
                                className="h-9 px-4"
                              >
                                Apply
                              </Button>
                            </div>
                          </div>

                          {linkError && (
                            <div className="text-xs text-destructive flex items-center gap-1.5">
                              <AlertTriangle className="size-3.5" />
                              {linkError}
                            </div>
                          )}
                        </div>
                      )}

                      {activeCoverTab === 'Unsplash' && (
                        <div className="space-y-4 py-2">
                          <input
                            type="text"
                            placeholder="Search Unsplash (coming soon)..."
                            value={unsplashSearch}
                            onChange={(e) => setUnsplashSearch(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                            disabled
                          />
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            Unsplash search is not supported yet.
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
              <div className="motion-page-container mx-auto">
                <div className="relative group/icon pl-0" style={{ marginTop: displayPage.cover_image ? '-40px' : '16px', marginBottom: '12px', width: 'fit-content' }}>
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

            <main className="motion-page-container mx-auto relative">
              {isSharedPage && (
                <div className="absolute top-4 right-6 lg:right-24 z-10 hidden sm:flex items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[11px] font-medium border border-border/50 uppercase tracking-wider">
                    {sharedPageCanEdit ? (
                      <>
                        <Pen className="size-3" />
                        Can Edit
                      </>
                    ) : (
                      <>
                        <Eye className="size-3" />
                        View Only
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="group/title-area">
                <div className={cn(
                  "flex items-center gap-3 text-muted-foreground/40 text-[13px] font-medium transition-all duration-300 px-0",
                  "mt-3 mb-2",
                  "opacity-0 group-hover/title-area:opacity-100"
                )}>
                  {!displayPage.icon && !isPageReadOnly && (
                    <button
                      className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                      onClick={() => {
                        setShowEmojiPicker(true);
                      }}
                    >
                      Add icon
                    </button>
                  )}
                  {!displayPage.cover_image && !isPageReadOnly && (
                    <button
                      className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                      onClick={() => {
                        const randomCover = ALL_COVER_IMAGES[Math.floor(Math.random() * ALL_COVER_IMAGES.length)];
                        if (pageId) {
                          updatePage.mutate({ id: pageId, updates: { cover_image: randomCover } });
                        }
                      }}
                    >
                      Add cover
                    </button>
                  )}
                  <button
                    className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                    onClick={() => {
                      toast("Comments feature coming soon!");
                    }}
                  >
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
                  readOnly={isPageReadOnly}
                  className={cn(
                    "w-full bg-transparent text-[40px] px-0 leading-[1.2] font-bold tracking-tight text-foreground/90 outline-none placeholder:text-foreground/25 mb-2",
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

          /* Default Layout Spacing: 720px Content Area with Responsive Gutters */
          .motion-page-container {
            max-width: 768px !important; /* 720px + 24px + 24px padding */
            padding-left: 1.5rem !important; /* 24px */
            padding-right: 1.5rem !important; /* 24px */
            width: 100% !important;
          }
          @media (min-width: 1024px) {
            .motion-page-container {
              max-width: 912px !important; /* 720px + 96px + 96px padding */
              padding-left: 6rem !important; /* 96px */
              padding-right: 6rem !important; /* 96px */
            }
          }

          /* Small Text Toggle Styles */
          .motion-page-small-text .tiptap.ProseMirror.simple-editor {
            font-size: 14px !important;
            line-height: 1.5 !important;
          }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h1,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="1"] { font-size: 1.5rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h2,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="2"] { font-size: 1.25rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h3,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="3"] { font-size: 1.15rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor h4,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor [data-type="detailsSummary"][data-level="4"] { font-size: 1.05rem !important; }
          .motion-page-small-text .tiptap.ProseMirror.simple-editor p,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor li,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor td,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor th,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor code,
          .motion-page-small-text .tiptap.ProseMirror.simple-editor blockquote {
            font-size: 14px !important;
          }

          /* Full Width Toggle Styles Override */
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
              padding-left: 6rem !important;
              padding-right: 6rem !important;
            }
          }
        `,
        }}
      />

      {/* Export to Notion Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={(open) => {
        setExportDialogOpen(open);
        if (!open) {
          setParentNotionPageId("");
          setTargetNotionPageId("");
          setExportMode('create');
        }
      }}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border border-border/80 shadow-2xl bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-semibold text-base">
              <img src="/integrations/Notion-logo.svg" alt="Notion" className="size-5 object-contain" />
              <span>Export to Notion</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Segmented Control */}
            <div className="flex border border-border/50 rounded-lg p-0.5 bg-muted/30">
              <button
                className={cn(
                  "flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all",
                  exportMode === 'create'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setExportMode('create')}
              >
                New Page (Default)
              </button>
              <button
                className={cn(
                  "flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all",
                  exportMode === 'append'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setExportMode('append')}
              >
                Link & Append
              </button>
            </div>

            {exportMode === 'create' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-normal">
                  Creates a new page in Notion. By default, it will auto-discover a page/database shared with your integration.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="parent-notion-page" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    Parent Page ID (Optional)
                  </label>
                  <input
                    id="parent-notion-page"
                    type="text"
                    placeholder="Auto-discover workspace root..."
                    value={parentNotionPageId}
                    onChange={(e) => setParentNotionPageId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border/60 bg-muted/20 text-xs text-foreground outline-none focus:border-primary/50 focus:bg-background transition-colors placeholder:text-muted-foreground/30 font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-normal">
                  Link this page to an already existing Notion page and overwrite its content.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="target-notion-page" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    Notion Page ID (Required)
                  </label>
                  <input
                    id="target-notion-page"
                    type="text"
                    placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                    value={targetNotionPageId}
                    onChange={(e) => setTargetNotionPageId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border/60 bg-muted/20 text-xs text-foreground outline-none focus:border-primary/50 focus:bg-background transition-colors placeholder:text-muted-foreground/30 font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-lg"
                onClick={() => {
                  setExportDialogOpen(false);
                  setParentNotionPageId("");
                  setTargetNotionPageId("");
                  setExportMode('create');
                }}
                disabled={exportNotion.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-xs rounded-lg shadow-md shadow-primary/10"
                disabled={
                  exportNotion.isPending ||
                  (exportMode === 'append' && !targetNotionPageId.trim())
                }
                onClick={() => {
                  exportNotion.mutate(
                    {
                      motionPageId: pageId!,
                      parentNotionPageId: parentNotionPageId.trim() || undefined,
                      targetNotionPageId: exportMode === 'append' ? targetNotionPageId.trim() : undefined,
                      mode: exportMode,
                    },
                    {
                      onSuccess: () => {
                        setExportDialogOpen(false);
                        setParentNotionPageId("");
                        setTargetNotionPageId("");
                        setExportMode('create');
                      },
                    }
                  );
                }}
              >
                {exportNotion.isPending && (
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                )}
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
