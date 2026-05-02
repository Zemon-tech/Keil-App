import {
  Menu,
  MoreHorizontal,
  Clock,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MotionSidebar } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

export function MotionHome() {
  const navigate = useNavigate();
  const { pages, addPage, sidebarOpen, setSidebarOpen } = useMotionStore();

  const recentPages = useMemo(() => {
    return pages.filter((p) => !p.isDeleted).slice(0, 6);
  }, [pages]);

  const handleCreatePage = () => {
    const newPage = addPage();
    navigate(`/motion/${newPage.id}`);
  };

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
        <header className="flex items-center justify-between px-2 py-1.5 z-40 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <MoreHorizontal className="size-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20">
          <main className="max-w-4xl mx-auto w-full px-6 pt-4">
            <div className="mb-12">
              <h1 className="text-[32px] font-bold tracking-tight text-foreground/90">
                Good morning
              </h1>
            </div>

            <section className="mb-10">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                <Clock className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Recently visited
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Card
                  onClick={handleCreatePage}
                  className="bg-muted/50 border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted transition-all cursor-pointer group rounded-2xl p-0 py-0 gap-0"
                >
                  <CardContent className="p-3 flex flex-col gap-2 h-full justify-center items-center">
                    <div className="text-xl h-9 w-9 flex items-center justify-center bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                      <Plus className="size-5" />
                    </div>
                    <h3 className="text-xs font-bold text-center text-foreground/70">New Page</h3>
                  </CardContent>
                </Card>

                {recentPages.map((item) => (
                  <Card
                    key={item.id}
                    onClick={() => navigate(`/motion/${item.id}`)}
                    className="bg-muted border-none hover:bg-muted/80 transition-colors cursor-pointer group rounded-2xl p-0 py-0 gap-0"
                  >
                    <CardContent className="p-3 flex flex-col gap-2">
                      <div className="text-xl h-9 w-9 flex items-center justify-center bg-muted/40 rounded-xl group-hover:scale-105 transition-transform">
                        {item.icon || "📄"}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-bold truncate leading-none text-foreground/90">
                          {item.title}
                        </h3>
                        <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 pt-1">
                          <span className="size-3.5 bg-muted rounded-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">
                            {item.title.charAt(0).toUpperCase()}
                          </span>
                          {formatDistanceToNow(item.updatedAt || Date.now(), { addSuffix: true })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
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
