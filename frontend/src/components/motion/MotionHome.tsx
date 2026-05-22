import { Menu, Clock, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MotionSidebar } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { useAppContext } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMotionPages, useCreateMotionPage } from "@/hooks/api/useMotionPages";

export function MotionHome() {
  const navigate = useNavigate();
  const { activeOrgId, activeSpaceId, mode } = useAppContext();
  const { sidebarOpen, setSidebarOpen, hydratePages } = useMotionStore();

  const { data: pages = [], isLoading } = useMotionPages(activeOrgId, activeSpaceId);
  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);

  const hydratePagesRef = useRef(hydratePages);
  hydratePagesRef.current = hydratePages;
  useEffect(() => {
    hydratePagesRef.current(pages);
  }, [pages]);

  const recentPages = useMemo(
    () =>
      [...pages]
        .filter((p) => !p.deleted_at)
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        .slice(0, 6),
    [pages]
  );

  const handleCreatePage = async () => {
    const newPage = await createPage.mutateAsync({});
    navigate(`/motion/${newPage.id}`);
  };

  const noContext = !activeOrgId || !activeSpaceId;

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative">
      {/* Motion sidebar */}
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
          sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <MotionSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <header className="h-12 flex items-center justify-between px-2 z-40 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="size-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20">
          <main className="max-w-4xl mx-auto w-full px-6 pt-4">
            <div className="mb-12">
              <h1 className="text-[32px] font-bold tracking-tight text-foreground/90">
                Good morning
              </h1>
            </div>

            {noContext ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Select an organisation and space to use Motion.
                </p>
              </div>
            ) : (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                  <Clock className="size-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Recently visited
                  </span>
                </div>

                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading pages…
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {/* New page card */}
                    <div
                      onClick={handleCreatePage}
                      className="w-[120px] flex-shrink-0 rounded-xl border border-dashed border-border bg-muted/40 hover:bg-muted hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
                    >
                      {/* Cover area */}
                      <div className="h-[80px] w-full bg-muted/60 flex items-center justify-center border-b border-dashed border-border group-hover:bg-muted transition-colors">
                        {createPage.isPending ? (
                          <Loader2 className="size-5 animate-spin text-muted-foreground/50" />
                        ) : (
                          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Plus className="size-4 text-primary" />
                          </div>
                        )}
                      </div>
                      {/* Info area */}
                      <div className="px-2.5 py-2">
                        <h3 className="text-xs font-semibold text-foreground/70 truncate">
                          New Page
                        </h3>
                      </div>
                    </div>

                    {recentPages.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/motion/${item.id}`)}
                        className="w-[120px] flex-shrink-0 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-all cursor-pointer group overflow-hidden"
                      >
                        {/* Cover image area */}
                        <div className="h-[52px] w-full overflow-hidden bg-muted relative">
                          {item.cover_image ? (
                            <img
                              src={item.cover_image}
                              alt=""
                              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                        </div>

                        {/* Info area with overlapping icon */}
                        <div className="px-2.5 pt-1 pb-2">
                          {/* Icon overlapping cover */}
                          <div className="text-xl -mt-4 mb-1 w-7 h-7 flex items-center justify-center leading-none">
                            <span className="group-hover:scale-110 transition-transform duration-200 drop-shadow-sm">
                              {item.icon || "📄"}
                            </span>
                          </div>
                          <h3 className="text-xs font-semibold truncate leading-tight text-foreground/90">
                            {item.title}
                          </h3>
                          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-1">
                            <span className="size-3 bg-muted-foreground/20 rounded-full flex items-center justify-center text-[6px] font-bold text-muted-foreground shrink-0">
                              {item.title.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate">
                              {formatDistanceToNow(new Date(item.updated_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      <div className="fixed bottom-6 right-6">
        <Button
          size="icon"
          className="size-10 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl transition-transform hover:scale-110 active:scale-95"
        >
          <span className="text-lg">🎨</span>
        </Button>
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
    </div>
  );
}