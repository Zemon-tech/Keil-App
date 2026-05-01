import { useState } from "react";
import {
  Menu,
  MoreHorizontal,
  Clock,
  BookOpen,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MotionSidebar } from "./MotionSidebar";

const recentlyVisited = [
  { id: 1, title: "KEIL HQ", time: "6m ago", icon: "🏢", color: "bg-slate-800" },
  { id: 2, title: "Manasvi Agarwal", time: "15h ago", icon: "💀", color: "bg-slate-800" },
  { id: 3, title: "Rohan Vashist", time: "15h ago", icon: "👳", color: "bg-slate-800" },
  { id: 4, title: "ZEMON TEAM", time: "15h ago", icon: "🌳", color: "bg-slate-800" },
  { id: 5, title: "Quild - May Training Plan", time: "4h ago", icon: "📄", color: "bg-slate-800" },
  { id: 6, title: "Krishna Kum...", time: "16h ago", icon: "📄", color: "bg-slate-800" },
];

const learnItems = [
  {
    id: 1,
    title: "The ultimate guide to Notion templates",
    time: "5m read",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "Customize & style your content",
    time: "9m read",
    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 3,
    title: "Getting started with projects and tasks",
    time: "8m read",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 4,
    title: "Using Notion AI to your impact",
    time: "3m read",
    image: "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=800&auto=format&fit=crop",
  },
];

export function MotionPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-dvh w-full bg-[#111] text-white overflow-hidden relative">
      {/* Sidebar Push Layout */}
      <div className={cn(
        "h-full transition-all duration-300 ease-in-out overflow-hidden border-r border-[#252525]",
        sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
      )}>
        <MotionSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Top Header - Sticky with toggle */}
        <header className="flex items-center justify-between px-6 py-4 z-40 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/50 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground/50 hover:text-white transition-colors">
              <MoreHorizontal className="size-5" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar-page pb-20">
          <main className="max-w-4xl mx-auto w-full px-6 pt-4">
            {/* Greeting - Centered and Compact */}
            <div className="mb-12">
              <h1 className="text-[32px] font-bold tracking-tight text-white/90">Good morning</h1>
            </div>

            {/* Recently Visited - Compact Grid */}
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                <Clock className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Recently visited</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {recentlyVisited.map((item) => (
                  <Card key={item.id} className="bg-[#1a1a1a] border-none hover:bg-[#252525] transition-colors cursor-pointer group rounded-2xl p-0 py-0 gap-0">
                    <CardContent className="p-3 flex flex-col gap-2">
                      <div className="text-xl h-9 w-9 flex items-center justify-center bg-slate-800/40 rounded-xl group-hover:scale-105 transition-transform">
                        {item.icon}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-bold truncate leading-none text-white/90">{item.title}</h3>
                        <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 pt-1">
                          <span className="size-3.5 bg-[#252525] rounded-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">S</span>
                          {item.time}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Learn Section - No internal padding for thumbnails */}
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                <BookOpen className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Learn</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {learnItems.map((item) => (
                  <Card key={item.id} className="bg-[#1a1a1a] border-none overflow-hidden hover:bg-[#252525] transition-colors cursor-pointer group rounded-2xl flex flex-col h-full p-0 py-0 gap-0">
                    {/* Thumbnail - Flush to top/sides */}
                    <div className="aspect-[16/10] overflow-hidden w-full">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    {/* Content - Compact padding */}
                    <CardContent className="p-4 flex flex-col flex-1 gap-2">
                      <h3 className="text-sm font-bold leading-tight text-white/90 group-hover:text-white transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      <div className="mt-auto flex items-center gap-2 text-muted-foreground/50">
                        <BookOpen className="size-3" />
                        <span className="text-[10px] font-medium tracking-tight">{item.time}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Upcoming Events - Compact Card */}
            <section>
              <div className="flex items-center gap-2 mb-4 text-muted-foreground/60">
                <Calendar className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Upcoming events</span>
              </div>
              <Card className="bg-[#1a1a1a] border-none p-8 flex flex-col items-center justify-center text-center gap-4 rounded-2xl">
                <div className="size-10 bg-[#252525] rounded-xl flex items-center justify-center text-muted-foreground/60">
                  <Calendar className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-white/90">Connect AI Meeting Notes</h3>
                  <p className="text-xs text-muted-foreground/50 max-w-[280px]">
                    Automatically sync your calendar and generate AI-powered summaries for every meeting.
                  </p>
                </div>
                <Button variant="outline" className="mt-1 border-[#333] text-[11px] h-8 px-4 bg-transparent hover:bg-white/5 rounded-full font-bold">
                  Connect Calendar
                </Button>
              </Card>
            </section>
          </main>
        </div>
      </div>

      {/* Bottom Right Avatar */}
      <div className="fixed bottom-6 right-6">
        <Button size="icon" className="size-10 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl transition-transform hover:scale-110 active:scale-95">
          <span className="text-lg">🎨</span>
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{
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
      `}} />
    </div>
  );
}
