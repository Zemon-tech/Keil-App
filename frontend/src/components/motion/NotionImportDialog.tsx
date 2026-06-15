import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchNotionPages, useImportNotionPage } from "@/hooks/api/useNotion";
import { useAppContext } from "@/contexts/AppContext";
import { Search, Loader2, HelpCircle, ArrowRight, FileText, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageIcon } from "./MotionSidebar";

interface NotionImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
}

export function NotionImportDialog({
  isOpen,
  onOpenChange,
  parentId = null,
}: NotionImportDialogProps) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  // Debounce query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isError, error } = useSearchNotionPages(debouncedQuery);
  const importPage = useImportNotionPage();

  const handleImport = async (notionPageId: string) => {
    if (!activeOrgId || !activeSpaceId) return;

    try {
      await importPage.mutateAsync({
        notionPageId,
        orgId: activeOrgId,
        spaceId: activeSpaceId,
        parentId,
      });
      onOpenChange(false);
      setSearchQuery("");
    } catch (err) {
      console.error("[notion-import] Import failed:", err);
    }
  };

  const results = data?.results || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden border border-border/80 shadow-2xl bg-background/95 backdrop-blur-md rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                <img src="/integrations/notion.png" alt="Notion" className="size-5 object-contain" />
                Import from Notion
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/85">
                Search and select pages from your connected Notion workspace to import.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground active:scale-95 transition-transform"
              onClick={() => setShowGuide(!showGuide)}
              title="Show guide"
            >
              <HelpCircle className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Informational connection guide */}
        {showGuide && (
          <div className="px-6 py-4 bg-muted/30 border-b border-border/40 text-xs text-muted-foreground space-y-2 animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-start gap-2 font-medium text-foreground">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <span>Can't find a specific page?</span>
            </div>
            <p className="pl-6 text-[11px] leading-relaxed">
              Notion requires pages to be explicitly shared with your integration. In Notion, open the page you want to import, click <strong>"..." (options)</strong> in the top-right, go to <strong>"Connections"</strong>, and search for/add your integration.
            </p>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Type to search Notion workspace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-11 bg-muted/20 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/45 rounded-xl transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Results Area */}
          <div className="min-h-[200px] max-h-[300px] overflow-y-auto pr-1 no-scrollbar-custom">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground animate-pulse">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs font-medium">Searching workspace...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-rose-500 gap-2">
                <p className="font-semibold">Search failed</p>
                <p className="text-muted-foreground text-[11px]">{(error as any)?.response?.data?.message || error.message}</p>
              </div>
            ) : !debouncedQuery.trim() ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/60 gap-2">
                <FileText className="size-8 stroke-[1.5]" />
                <p className="text-xs font-semibold">Start typing to search</p>
                <p className="text-[11px]">Pages must be shared with the integration to appear.</p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/60 gap-2">
                <Search className="size-8 stroke-[1.5]" />
                <p className="text-xs font-semibold">No pages found</p>
                <p className="text-[11px]">Check the spelling or verify page connection settings.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((page, index) => {
                  let title = "Untitled";
                  if (page.properties) {
                    const titleKey = Object.keys(page.properties).find(
                      (key) => page.properties?.[key]?.type === "title"
                    );
                    if (titleKey && page.properties[titleKey]?.title?.[0]) {
                      title = page.properties[titleKey].title[0].plain_text || "Untitled";
                    }
                  }

                  // Parse Notion icon formats
                  let customIcon: string | null = null;
                  if (page.icon) {
                    if (page.icon.type === "emoji") {
                      customIcon = page.icon.emoji || null;
                    } else if (page.icon.type === "external") {
                      customIcon = page.icon.external?.url || null;
                    } else if (page.icon.type === "file") {
                      customIcon = page.icon.file?.url || null;
                    }
                  }

                  const isImporting = importPage.isPending && importPage.variables?.notionPageId === page.id;

                  return (
                    <div
                      key={page.id}
                      onClick={() => !isImporting && handleImport(page.id)}
                      style={{ animationDelay: `${index * 30}ms` }}
                      className={cn(
                        "group flex items-center justify-between p-3 rounded-xl hover:bg-accent/60 cursor-pointer active:scale-[0.98] transition-all duration-200 border border-transparent hover:border-border/30 animate-in fade-in-0 slide-in-from-bottom-2",
                        isImporting && "opacity-60 pointer-events-none"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 rounded-lg bg-muted/60 flex items-center justify-center text-base shrink-0 select-none">
                          <PageIcon icon={customIcon} className="size-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground/90 truncate group-hover:text-foreground">
                            {title}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 truncate max-w-[320px]">
                            {page.url}
                          </p>
                        </div>
                      </div>
                      
                      <div className="shrink-0 flex items-center justify-center size-6 rounded-full group-hover:bg-primary/10 transition-colors">
                        {isImporting ? (
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                        ) : (
                          <ArrowRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
