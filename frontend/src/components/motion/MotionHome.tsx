import { Menu, Clock, Plus, Loader2, Share2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MotionSidebar, PageIcon } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { useAppContext } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMotionPages, useCreateMotionPage, useSharedToSpace, type MotionPageDTO } from "@/hooks/api/useMotionPages";

interface PageCardGridProps {
  pages: MotionPageDTO[];
  onPageClick: (id: string) => void;
  emptyMessage: string;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  isCreatePending?: boolean;
}

function PageCardGrid({
  pages,
  onPageClick,
  emptyMessage,
  showCreateButton,
  onCreateClick,
  isCreatePending,
}: PageCardGridProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {showCreateButton && onCreateClick && (
        <div
          onClick={onCreateClick}
          className="w-[120px] flex-shrink-0 rounded-xl border border-dashed border-border bg-muted/40 hover:bg-muted hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
        >
          {/* Cover area */}
          <div className="h-[52px] w-full bg-muted/60 flex items-center justify-center border-b border-dashed border-border group-hover:bg-muted transition-colors">
            {isCreatePending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
            ) : (
              <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plus className="size-4 text-primary" />
              </div>
            )}
          </div>
          {/* Info area */}
          <div className="px-2.5 pt-2 pb-2">
            <h3 className="text-xs font-semibold text-foreground/70 truncate leading-tight">
              New Page
            </h3>
            <p className="text-[10px] text-muted-foreground/30 flex items-center gap-1 mt-1">
              Create blank
            </p>
          </div>
        </div>
      )}

      {pages.length === 0 && !showCreateButton ? (
        <p className="text-xs text-muted-foreground/60 italic py-2 pl-1">
          {emptyMessage}
        </p>
      ) : (
        pages.map((item) => (
          <div
            key={item.id}
            onClick={() => onPageClick(item.id)}
            className="w-[120px] flex-shrink-0 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-all cursor-pointer group overflow-hidden"
          >
            {/* Cover image area */}
            <div className="h-[52px] w-full overflow-hidden bg-muted relative">
              {item.cover_image ? (
                <img
                  src={item.cover_image}
                  alt=""
                  className="size-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="size-full bg-muted" />
              )}
            </div>

            {/* Info area with overlapping icon */}
            <div className="px-2.5 pt-1 pb-2">
              {/* Icon overlapping cover */}
              <div className="text-xl -mt-4 mb-1 size-7 flex items-center justify-center leading-none">
                <PageIcon
                  icon={item.icon}
                  className="size-5 text-xl text-foreground/80 group-hover:scale-110 transition-transform duration-200 drop-shadow-sm"
                />
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
        ))
      )}
    </div>
  );
}

export function MotionHome() {
  const navigate = useNavigate();
  const { activeOrgId, activeSpaceId, activeOrg, activeSpace } = useAppContext();
  const { sidebarOpen, setSidebarOpen } = useMotionStore();

  const { data: pages = [], isLoading: isPagesLoading } = useMotionPages(activeOrgId, activeSpaceId);
  const { data: sharedPages = [], isLoading: isSharedLoading } = useSharedToSpace(activeOrgId, activeSpaceId);
  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);

  const recentlyOpenedPages = useMotionStore((s) => s.recentlyOpenedPages);
  const key = `${activeOrgId}:${activeSpaceId}`;
  const openedIds = recentlyOpenedPages[key] || [];

  const recentPages = useMemo(() => {
    const allPages = [...pages, ...sharedPages].filter((p) => !p.deleted_at);
    if (openedIds.length > 0) {
      return openedIds
        .map((id) => allPages.find((p) => p.id === id))
        .filter((p): p is MotionPageDTO => !!p)
        .slice(0, 6);
    }
    return allPages
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, 6);
  }, [pages, sharedPages, openedIds]);

  const privatePagesList = useMemo(() => {
    return pages.filter((p) => !p.parent_id && !p.notion_page_id && !p.deleted_at);
  }, [pages]);

  const sharedPagesList = useMemo(() => {
    return sharedPages.filter((p) => !p.parent_id && !p.notion_page_id && !p.deleted_at);
  }, [sharedPages]);

  const notionPagesList = useMemo(() => {
    return [...pages, ...sharedPages].filter(
      (p) => !!p.notion_page_id && !p.parent_id && !p.deleted_at
    );
  }, [pages, sharedPages]);

  const isLoading = isPagesLoading || isSharedLoading;

  const handleCreatePage = async () => {
    const newPage = await createPage.mutateAsync({});
    navigate(`/motion/${newPage.id}`);
  };

  const noContext = !activeOrgId || !activeSpaceId;
  const privateTitle = activeOrg?.is_personal || activeSpace?.is_private ? "Private Pages" : "Pages";

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
              <div className="space-y-12">
                {/* Recently visited */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                    <Clock className="size-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      Recently visited
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-wrap gap-3">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="w-[120px] h-[108px] flex-shrink-0 rounded-xl border border-border bg-muted/40 animate-pulse overflow-hidden flex flex-col justify-between p-2.5"
                        >
                          <div className="h-[40px] w-full bg-muted-foreground/10 rounded-md" />
                          <div className="space-y-1.5 mt-2">
                            <div className="h-3 w-16 bg-muted-foreground/15 rounded" />
                            <div className="h-2 w-10 bg-muted-foreground/10 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PageCardGrid
                      pages={recentPages}
                      onPageClick={(id) => navigate(`/motion/${id}`)}
                      emptyMessage="No recently visited pages"
                      showCreateButton={true}
                      onCreateClick={handleCreatePage}
                      isCreatePending={createPage.isPending}
                    />
                  )}
                </section>

                {/* Workspace / Private Pages */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                    <FileText className="size-3.5 text-blue-500/80" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      {privateTitle}
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-wrap gap-3">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-[120px] h-[108px] flex-shrink-0 rounded-xl border border-border bg-muted/40 animate-pulse overflow-hidden flex flex-col justify-between p-2.5"
                        >
                          <div className="h-[40px] w-full bg-muted-foreground/10 rounded-md" />
                          <div className="space-y-1.5 mt-2">
                            <div className="h-3 w-16 bg-muted-foreground/15 rounded" />
                            <div className="h-2 w-10 bg-muted-foreground/10 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PageCardGrid
                      pages={privatePagesList}
                      onPageClick={(id) => navigate(`/motion/${id}`)}
                      emptyMessage="No pages yet"
                    />
                  )}
                </section>

                {/* Shared with this space */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                    <Share2 className="size-3.5 text-emerald-500/80" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      Shared with this space
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-wrap gap-3">
                      {[...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="w-[120px] h-[108px] flex-shrink-0 rounded-xl border border-border bg-muted/40 animate-pulse overflow-hidden flex flex-col justify-between p-2.5"
                        >
                          <div className="h-[40px] w-full bg-muted-foreground/10 rounded-md" />
                          <div className="space-y-1.5 mt-2">
                            <div className="h-3 w-16 bg-muted-foreground/15 rounded" />
                            <div className="h-2 w-10 bg-muted-foreground/10 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PageCardGrid
                      pages={sharedPagesList}
                      onPageClick={(id) => navigate(`/motion/${id}`)}
                      emptyMessage="No shared pages yet"
                    />
                  )}
                </section>

                {/* Notion Imported */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                    <img
                      src="/integrations/Notion-logo.svg"
                      alt="Notion"
                      className="size-3.5 object-contain shrink-0"
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      Notion Imported
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-wrap gap-3">
                      {[...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="w-[120px] h-[108px] flex-shrink-0 rounded-xl border border-border bg-muted/40 animate-pulse overflow-hidden flex flex-col justify-between p-2.5"
                        >
                          <div className="h-[40px] w-full bg-muted-foreground/10 rounded-md" />
                          <div className="space-y-1.5 mt-2">
                            <div className="h-3 w-16 bg-muted-foreground/15 rounded" />
                            <div className="h-2 w-10 bg-muted-foreground/10 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <PageCardGrid
                      pages={notionPagesList}
                      onPageClick={(id) => navigate(`/motion/${id}`)}
                      emptyMessage="No imported pages yet"
                    />
                  )}
                </section>
              </div>
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