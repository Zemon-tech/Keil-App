import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Menu, MoreHorizontal, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MotionSidebar } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import throttle from "lodash.throttle";

export function MotionPage() {
  const navigate = useNavigate();
  const { pageId } = useParams();
  const [pageEditor, setPageEditor] = useState<any>(null);

  const { 
    pages, 
    addPage, 
    updatePage, 
    deletePage, 
    getPageById, 
    sidebarOpen,
    setSidebarOpen
  } = useMotionStore();

  const page = useMemo(() => {
    if (!pageId) return null;
    return getPageById(pageId);
  }, [pageId, pages, getPageById]);

  const parentPage = useMemo(() => {
    if (!page?.parentId) return null;
    return getPageById(page.parentId);
  }, [page?.parentId, pages, getPageById]);


  useEffect(() => {
    if (!pageId || !page) {
      if (pages.length > 0) navigate("/motion", { replace: true });
      return;
    }
  }, [navigate, page, pageId, pages.length]);

  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    setTitleDraft(page?.title ?? "");
  }, [page?.title]);

  const saveContent = useMemo(
    () =>
      throttle((id: string, json: any) => {
        updatePage(id, { content: json });
      }, 400),
    [updatePage]
  );

  const handleAddSubpage = () => {
    if (!pageId) return;
    const newPage = addPage({ parentId: pageId });
    navigate(`/motion/${newPage.id}`);
  };

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
                <span className="text-foreground/70 max-w-[100px] truncate">{page.title}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-destructive transition-colors"
              onClick={() => {
                if (confirm("Are you sure you want to delete this page?")) {
                  deletePage(pageId);
                  navigate("/motion");
                }
              }}
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
                  updatePage(pageId, { title: titleDraft.trim() || "Untitled" })
                }
                className="w-full bg-transparent text-[44px] leading-[1.1] font-bold tracking-tight text-foreground/90 outline-none placeholder:text-foreground/25"
                placeholder="Untitled"
              />

              <div className="pt-6">
                <SimpleEditor
                  key={pageId}
                  content={page.content}
                  onContentChange={(json) => saveContent(pageId, json)}
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
