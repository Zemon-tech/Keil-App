import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Menu, MoreHorizontal, Trash2, ChevronRight, Search, Sparkles, FileText, Image as ImageLucide, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MotionSidebar } from "./MotionSidebar";
import { useMotionStore } from "@/store/useMotionStore";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import throttle from "lodash.throttle";
import { LUCIDE_ICON_MAP, ICON_CATEGORIES, ALL_ICON_NAMES, resolveLucideIcon } from "./iconMap";
import { CoverPicker } from "./CoverPicker";

export function MotionPage() {
  const navigate = useNavigate();
  const { pageId } = useParams();
  const [pageEditor, setPageEditor] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<'Emoji' | 'Icons' | 'Upload'>('Emoji');
  const [emojiSearch, setEmojiSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleContentChange = useCallback((json: any) => {
    if (pageId) saveContent(pageId, json);
  }, [pageId, saveContent]);

  const handleAddSubpage = useCallback(() => {
    if (!pageId) return;
    const newPage = addPage({ parentId: pageId });
    return newPage;
  }, [pageId, addPage]);

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
                  className="hover:text-foreground transition-colors max-w-[100px] truncate flex items-center gap-1"
                >
                  <span className="shrink-0 flex items-center justify-center size-4">
                    {parentPage.icon?.startsWith("lucide:") ? (
                      (() => {
                        const Icon = resolveLucideIcon(parentPage.icon.split(":")[1]);
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
                    {page.icon?.startsWith("lucide:") ? (
                      (() => {
                        const Icon = resolveLucideIcon(page.icon.split(":")[1]);
                        return <Icon className="size-3.5" />;
                      })()
                    ) : (
                      page.icon || "📄"
                    )}
                  </span>
                  <span className="truncate">{page.title}</span>
                </div>
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

        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20 group/page">
          <div className="w-full pt-0 relative">
            {page.coverImage ? (
              <div className="relative group/cover">
                <div className="h-[280px] w-full overflow-hidden">
                  <img
                    src={page.coverImage}
                    alt="cover"
                    className="h-full w-full object-cover transition-opacity duration-500"
                    onLoad={(e) => (e.currentTarget.style.opacity = "1")}
                    style={{ opacity: 0 }}
                  />
                </div>
                <div className="absolute bottom-4 right-6 opacity-0 group-hover/cover:opacity-100 transition-opacity flex gap-2 z-50">
                  <div className="relative">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium border border-border/20 shadow-sm"
                      onClick={() => setShowCoverPicker(!showCoverPicker)}
                    >
                      Change cover
                    </Button>
                    {showCoverPicker && (
                      <CoverPicker 
                        onSelect={(url) => updatePage(pageId, { coverImage: url })}
                        onRemove={() => {
                          updatePage(pageId, { coverImage: undefined });
                          setShowCoverPicker(false);
                        }}
                        onClose={() => setShowCoverPicker(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-24 w-full bg-background group-hover/page:bg-muted/10 transition-colors" />
            )}

            <main className="max-w-[900px] mx-auto w-full relative px-12 lg:px-16">
              {/* Icon Overlay */}
              {(page.icon || showEmojiPicker) && (
                <div className="absolute -top-[52px] left-12 lg:left-16 group/icon z-20">
                  <div 
                    className="text-[72px] leading-none hover:bg-muted/20 rounded-2xl p-2 transition-colors select-none cursor-pointer flex items-center justify-center bg-background shadow-sm border border-border/10 overflow-hidden shrink-0"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    {page.icon?.startsWith("data:image") ? (
                      <img src={page.icon} alt="icon" className="size-full object-cover rounded-xl" />
                    ) : page.icon?.startsWith("lucide:") ? (
                      (() => {
                        const Icon = resolveLucideIcon(page.icon.split(":")[1]);
                        return <Icon className="size-[64px] text-foreground/80" />;
                      })()
                    ) : page.icon ? (
                      page.icon
                    ) : (
                      <Smile className="size-[64px] text-muted-foreground/30" />
                    )}
                  </div>
                  
                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-2 z-[110] w-[360px] bg-popover rounded-xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col">
                      <div className="flex items-center gap-4 px-4 pt-3 border-b border-border/50 relative">
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
                        <div className="ml-auto flex items-center gap-2 pb-2">
                          <button 
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => {
                              if (activeEmojiTab === 'Emoji') {
                                const emojis = ["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚", "🐱", "🐶", "🍕", "🍔", "🍦", "🎸", "🎮", "🌍", "🌈", "🔥", "💎"];
                                const random = emojis[Math.floor(Math.random() * emojis.length)];
                                updatePage(pageId, { icon: random });
                              } else if (activeEmojiTab === 'Icons') {
                                const random = ALL_ICON_NAMES[Math.floor(Math.random() * ALL_ICON_NAMES.length)];
                                updatePage(pageId, { icon: `lucide:${random}` });
                              }
                            }}
                            title="Random"
                          >
                            <Sparkles className="size-3.5" />
                          </button>
                          <div className="size-3.5 rounded-full border border-border bg-muted/50" />
                          <button 
                            className="text-[13px] text-muted-foreground hover:text-foreground pl-2"
                            onClick={() => {
                              updatePage(pageId, { icon: undefined });
                              setShowEmojiPicker(false);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-hidden flex flex-col min-h-[360px]">
                        {activeEmojiTab === 'Emoji' && (
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
                              {["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚", "📔", "📕", "📗", "📘", "📙", "💼", "📁", "📂", "📅", "📆", "🗓️", "📊", "📈", "📉", "🔍", "🕵️", "🏠", "🏡", "🏘️", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏰", "🏯", "🗼", "🗽", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌆", "🌇", "🌉", "🌌", "🎠", "🎡", "🎢", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🚚", "🚛", "🚜", "🚲", "🚏", "🛤️", "⛽", "🚨", "🚥", "🚦", "🚧", "⚓", "⛵", "🚣", "🚤", "🛳️", "⛴️", "🚢", "✈️", "🛫", "🛬", "💺", "🚁", "🚟", "🚠", "🚡", "🚀", "🛸", "🛰️", "⌛", "⏳", "⌚", "⏰", "⏱️", "⏲️", "🕰️", "🌡️", "☀️", "🌝", "🌞", "⭐", "🌟", "🌠", "☁️", "⛅", "⛈️", "🌤️", "🌥️", "🌦️", "🌧️", "🌨️", "🌩️", "🌪️", "🌫️", "🌬️", "🌀", "🌈", "🌂", "☂️", "☔", "⛱️", "⚡", "❄️", "☃️", "⛄", "☄️", "🔥", "💧", "🌊", "🎃", "🎄", "🎆", "🎇", "🧨", "✨", "🎈", "🎉", "🎊", "🎋", "🎍", "🎎", "🎏", "🎐", "🎑", "🧧", "🎀", "🎁", "🎗️", "🎟️", "🎫", "🎖️", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "⚾", "🥎", "🏀", "🏐", "🏈", "🏉", "🎾", "🥏", "🎳", "🏏", "🏑", "🏒", "🥍", "🏓", "🏸", "🥊", "🥋", "🥅", "⛳", "⛸️", "🎣", "🤿", "🎽", "🎿", "🛷", "🥌", "🎯", "🪀", "🪁", "🎱", "🔮", "🧿", "🎮", "🕹️", "🎰", "🎲", "🧩", "🧸", "♠️", "♥️", "♦️", "♣️", "♟️", "🃏", "🀄", "🎴", "🎭", "🖼️", "🎨", "🧵", "🧶"].filter(e => e.includes(emojiSearch) || emojiSearch === "").map(emoji => (
                                <button
                                  key={emoji}
                                  className="size-8 flex items-center justify-center hover:bg-muted rounded-md transition-colors text-xl"
                                  onClick={() => {
                                    updatePage(pageId, { icon: emoji });
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
                                placeholder="Filter icons..." 
                                className="bg-transparent border-none outline-none text-[13px] w-full"
                                value={emojiSearch}
                                onChange={(e) => setEmojiSearch(e.target.value)}
                              />
                            </div>
                            <div className="overflow-y-auto custom-scrollbar pr-1 flex-1">
                              {ICON_CATEGORIES.map((category) => (
                                <div key={category.name} className="mb-4 last:mb-0">
                                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1.5 px-1">
                                    {category.name}
                                  </h3>
                                  <div className="grid grid-cols-8 gap-1">
                                    {category.icons
                                      .filter(name => name.toLowerCase().includes(emojiSearch.toLowerCase()))
                                      .map((name) => {
                                        const Icon = resolveLucideIcon(name);
                                        return (
                                          <button
                                            key={name}
                                            className="size-8 flex items-center justify-center hover:bg-muted rounded-md transition-colors"
                                            title={name}
                                            onClick={() => {
                                              updatePage(pageId, { icon: `lucide:${name}` });
                                              setShowEmojiPicker(false);
                                            }}
                                          >
                                            <Icon className="size-4 text-foreground/70" />
                                          </button>
                                        );
                                      })}
                                  </div>
                                </div>
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
                                    updatePage(pageId, { icon: reader.result as string });
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
                    </div>
                  )}

                  <button 
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground size-5 rounded-full flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePage(pageId, { icon: undefined });
                      setShowEmojiPicker(false);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}

              <div className={cn(
                "flex items-center gap-3 text-muted-foreground/40 text-[13px] font-medium transition-all duration-300",
                page.icon ? "mt-10 mb-4" : "mt-8 mb-4",
                "opacity-0 group-hover/page:opacity-100"
              )}>
                {!page.icon && (
                  <button 
                    className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                    onClick={() => {
                      setShowEmojiPicker(true);
                    }}
                  >
                    Add icon
                  </button>
                )}
                {!page.coverImage && (
                  <button 
                    className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                    onClick={() => {
                      updatePage(pageId, { coverImage: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1600&auto=format&fit=crop" });
                      setTimeout(() => setShowCoverPicker(true), 0);
                    }}
                  >
                    Add cover
                  </button>
                )}
                <button className="hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5">
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
