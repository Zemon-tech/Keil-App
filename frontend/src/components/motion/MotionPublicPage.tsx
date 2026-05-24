import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import api from "@/lib/api";
import type { MotionPageDTO } from "@/hooks/api/useMotionPages";

// ─── MotionPublicPage ─────────────────────────────────────────────────────────
// Unauthenticated read-only view of a page shared via public link.
// Handles two URL patterns:
//   1. /motion/:slug/:pageId  — new clean URL (public sharing must be enabled)
//   2. /notes/public/:token   — legacy token-based URL (kept for compatibility)
// Mounted outside <Layout> and <ProtectedRoute> in App.tsx.

type FetchState =
  | { status: "loading" }
  | { status: "ok"; page: MotionPageDTO }
  | { status: "not_found" }
  | { status: "error" };

// Props tell us which URL pattern we're in
interface MotionPublicPageProps {
  mode?: "token" | "pageId";
}

export function MotionPublicPage({ mode = "token" }: MotionPublicPageProps) {
  // Both route patterns expose their param under different names
  const { token, pageId } = useParams<{ token?: string; pageId?: string }>();
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const fetchPage = async () => {
      try {
        let res: { data: { data: MotionPageDTO } };

        if (mode === "pageId") {
          if (!pageId) {
            setState({ status: "not_found" });
            return;
          }
          res = await api.get<{ data: MotionPageDTO }>(
            `v1/notes/public/page/${pageId}`
          );
        } else {
          if (!token) {
            setState({ status: "not_found" });
            return;
          }
          res = await api.get<{ data: MotionPageDTO }>(
            `v1/notes/public/${token}`
          );
        }

        if (!cancelled) setState({ status: "ok", page: res.data.data });
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          setState({ status: "not_found" });
        } else {
          setState({ status: "error" });
        }
      }
    };

    setState({ status: "loading" });
    fetchPage();

    return () => {
      cancelled = true;
    };
  }, [token, pageId, mode]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state.status === "loading") {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not found / disabled ─────────────────────────────────────────────────────
  if (state.status === "not_found") {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
        <AlertCircle className="size-10 text-muted-foreground/50" />
        <div>
          <h1 className="text-xl font-bold">Link not found or access disabled</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This page may have been deleted or public sharing has been turned off.
          </p>
        </div>
        <Link
          to="/"
          className="mt-2 text-sm text-primary hover:underline underline-offset-4"
        >
          Go to KeilHQ
        </Link>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state.status === "error") {
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

  // ── Page ─────────────────────────────────────────────────────────────────────
  const { page } = state;

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      {/* Cover image */}
      <div className="h-[240px] w-full overflow-hidden bg-muted">
        <img
          src={
            page.cover_image ??
            "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1600&auto=format&fit=crop"
          }
          alt="cover"
          className="size-full object-cover opacity-80"
        />
      </div>

      <main className="max-w-[900px] mx-auto w-full pt-6 px-6 pb-24">
        {/* Branding strip */}
        <div className="flex items-center gap-1.5 mb-6 text-xs text-muted-foreground/50">
          <FileText className="size-3.5" />
          <span>Shared via</span>
          <Link
            to="/"
            className="font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            KeilHQ Motion
          </Link>
        </div>

        {/* Title */}
        <h1 className="text-[44px] leading-[1.1] font-bold tracking-tight text-foreground/90 mb-6">
          {page.title}
        </h1>

        {/* Read-only editor */}
        <SimpleEditor
          key={page.id}
          content={page.content}
          // No onContentChange — read-only mode
        />
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          /* Hide all editor toolbar and interactive elements in public view */
          .tiptap { pointer-events: none; user-select: text; }
        `,
        }}
      />
    </div>
  );
}
