import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Menu, MoreHorizontal, Trash2, ChevronRight, Search, Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap, Sparkles, FileText, Image as ImageLucide, Smile } from "lucide-react";
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<'Emoji' | 'Icons' | 'Upload'>('Emoji');
  const [emojiSearch, setEmojiSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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
                    {page.icon?.startsWith("lucide:") ? (
                      (() => {
                        const iconName = page.icon.split(":")[1];
                        const icons: Record<string, any> = { Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap };
                        const Icon = icons[iconName] || FileText;
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
              <div className="h-[280px] w-full overflow-hidden relative group/cover">
                <img
                  src={page.coverImage}
                  alt="cover"
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-4 right-6 opacity-0 group-hover/cover:opacity-100 transition-opacity flex gap-2">
                  <input 
                    type="file" 
                    ref={coverInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          updatePage(pageId, { coverImage: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Upload cover
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 text-xs font-medium"
                    onClick={() => {
                      const covers = [
                        "https://images.unsplash.com/photo-1518837695005-2083093ee35b",
                        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                        "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
                        "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
                        "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
                      ];
                      const random = covers[Math.floor(Math.random() * covers.length)] + "?q=80&w=1600&auto=format&fit=crop";
                      updatePage(pageId, { coverImage: random });
                    }}
                  >
                    Random cover
                  </Button>
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
                        const iconName = page.icon.split(":")[1];
                        const icons: Record<string, any> = { Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap };
                        const Icon = icons[iconName] || FileText;
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
                                const icons = ["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚"];
                                const random = icons[Math.floor(Math.random() * icons.length)];
                                updatePage(pageId, { icon: random });
                              } else if (activeEmojiTab === 'Icons') {
                                const iconNames = ['Plane', 'Heart', 'Star', 'Cloud', 'Moon', 'Sun', 'Bell', 'Camera', 'Gift', 'Coffee', 'Music', 'Code', 'Terminal', 'Database', 'Shield', 'Layout', 'Settings', 'User', 'Users', 'Mail', 'Map', 'Flag', 'Bookmark', 'Calendar', 'CheckCircle', 'HelpCircle', 'Info', 'AlertTriangle', 'AlertCircle', 'XCircle', 'Clock', 'Zap'];
                                const random = iconNames[Math.floor(Math.random() * iconNames.length)];
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
                              {["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚", "📔", "📕", "📗", "📘", "📙", "💼", "📁", "📂", "📅", "📆", "🗓️", "📊", "📈", "📉", "🔍", "🕵️", "🏠", "🏡", "🏘️", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏰", "🏯", "🗼", "🗽", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌆", "🌇", "🌉", "🌌", "🎠", "🎡", "🎢"].filter(e => e.includes(emojiSearch) || emojiSearch === "").map(emoji => (
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
                                    updatePage(pageId, { icon: `lucide:${item.name}` });
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
