import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MotionSidebar } from "./MotionSidebar";
import {
  getMotionPageById,
  updateMotionPageContent,
  updateMotionPageTitle,
} from "./motionStorage";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import throttle from "lodash.throttle";

export function MotionPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const { pageId } = useParams();
  const [pageEditor, setPageEditor] = useState<any>(null);

  const page = useMemo(() => {
    if (!pageId) return null;
    return getMotionPageById(pageId);
  }, [pageId]);

  useEffect(() => {
    if (!pageId) {
      navigate("/motion", { replace: true });
      return;
    }

    if (!page) {
      navigate("/motion", { replace: true });
    }
  }, [navigate, page, pageId]);

  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    setTitleDraft(page?.title ?? "");
  }, [page?.title]);

  const saveContent = useMemo(
    () =>
      throttle((id: string, json: any) => {
        updateMotionPageContent(id, json);
      }, 400),
    []
  );

  useEffect(() => {
    return () => {
      saveContent.cancel();
    };
  }, [saveContent]);

  if (!pageId || !page) {
    return (
      <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative" />
    );
  }

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative">
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
          sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <MotionSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <header className="flex items-center justify-between px-2 py-1 z-40 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20">
          <div className="w-full pt-0">
            <div className="h-[240px] w-full overflow-hidden bg-muted">
              <img
                src={
                  page.coverImage ??
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

              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  pageEditor?.commands?.focus?.("start");
                }}
                onBlur={() =>
                  updateMotionPageTitle(pageId, titleDraft.trim() || "Untitled")
                }
                className="w-full bg-transparent text-[44px] leading-[1.1] font-bold tracking-tight text-foreground/90 outline-none placeholder:text-foreground/25"
                placeholder="Untitled"
              />

              <div className="pt-6">
                <SimpleEditor
                  content={page.content}
                  onContentChange={(json) => saveContent(pageId, json)}
                  onReady={(editor) => setPageEditor(editor)}
                />
              </div>
            </main>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar-page::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar-page::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar-page:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
      `,
        }}
      />
    </div>
  );
}
