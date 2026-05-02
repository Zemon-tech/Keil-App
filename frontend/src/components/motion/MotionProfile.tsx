import { useState, useEffect, useMemo } from "react";
import { 
  User, 
  Mail, 
  Calendar, 
  FileText, 
  Trash2, 
  LogOut, 
  ChevronRight,
  Shield,
  Bell,
  Palette,
  ArrowLeft,
  Settings,
  Camera,
  Menu
} from "lucide-react";
import { MotionSidebar } from "./MotionSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMotionStore } from "@/store/useMotionStore";
import { cn } from "@/lib/utils";

export function MotionProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pages, sidebarOpen, setSidebarOpen } = useMotionStore();
  const pageCount = useMemo(() => pages.filter(p => !p.isDeleted).length, [pages]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
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
        </header>

        <div className="flex-1 bg-background text-foreground h-full overflow-y-auto custom-scrollbar-page pb-20">
          <div className="max-w-3xl mx-auto w-full px-6 py-12">
            {/* Top Navigation */}
            <div className="flex items-center gap-4 mb-10">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/motion")}
                className="rounded-full hover:bg-muted"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            </div>

            {/* Profile Header Card */}
            <div className="relative mb-8 group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent blur-3xl -z-10 opacity-50" />
              <Card className="bg-muted/30 border-border/50 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative group/avatar">
                      <div className="size-24 rounded-3xl bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary border border-primary/20 transition-transform group-hover/avatar:scale-105 duration-300">
                        {initial}
                      </div>
                      <Button 
                        size="icon" 
                        className="absolute -bottom-2 -right-2 size-8 rounded-full bg-background border border-border shadow-lg opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                      >
                        <Camera className="size-3.5" />
                      </Button>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-1">
                      <h2 className="text-3xl font-bold tracking-tight">{displayName}</h2>
                      <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                        <Mail className="size-4" />
                        {user?.email}
                      </p>
                      <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                        <div className="bg-muted/50 px-3 py-1 rounded-full text-[11px] font-medium text-foreground/60 border border-border/50">
                          Member since {new Date(user?.created_at || "").toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    <Button variant="outline" className="border-border/50 rounded-full h-10 px-6 font-bold" onClick={handleSignOut}>
                      <LogOut className="mr-2 size-4" />
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Quick Stats */}
              <Card className="bg-muted/20 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="size-4" />
                    Workspace Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{pageCount}</span>
                    <span className="text-sm text-muted-foreground">pages created</span>
                  </div>
                  <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 ease-out" 
                      style={{ width: `${Math.min((pageCount / 50) * 100, 100)}%` }} 
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground/50 italic">
                    You've used {Math.round((pageCount / 50) * 100)}% of your free space
                  </p>
                </CardContent>
              </Card>

              {/* Security Summary */}
              <Card className="bg-muted/20 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="size-4" />
                    Security Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Authentication</span>
                    <span className="text-[10px] font-bold text-green-500 uppercase px-2 py-0.5 bg-green-500/10 rounded">Verified</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Account Type</span>
                    <span className="text-[10px] font-bold text-primary uppercase px-2 py-0.5 bg-primary/10 rounded">Free Plan</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Settings Groups */}
            <div className="space-y-8">
              <section>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 mb-4">Preferences</h3>
                <div className="space-y-1 bg-muted/20 border border-border/50 rounded-2xl overflow-hidden">
                  <SettingsItem icon={<Palette className="size-4" />} title="Appearance" description="Customize how Motion looks on your device" />
                  <SettingsItem icon={<Bell className="size-4" />} title="Notifications" description="Manage your alert preferences" />
                  <SettingsItem icon={<Settings className="size-4" />} title="Language & Region" description="English (US), UTC+5:30" last />
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-destructive/50 uppercase tracking-widest px-1 mb-4">Danger Zone</h3>
                <div className="space-y-1 bg-destructive/5 border border-destructive/10 rounded-2xl overflow-hidden">
                  <SettingsItem 
                    icon={<Trash2 className="size-4 text-destructive" />} 
                    title="Delete Account" 
                    description="Permanently delete your account and all workspace data" 
                    danger 
                    last 
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
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

function SettingsItem({ 
  icon, 
  title, 
  description, 
  danger, 
  last 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <button 
      className={cn(
        "flex items-center w-full p-4 hover:bg-muted/50 transition-colors text-left group",
        !last && "border-b border-border/50"
      )}
    >
      <div className={cn(
        "size-9 rounded-xl flex items-center justify-center mr-4 shrink-0 transition-transform group-hover:scale-105",
        danger ? "bg-destructive/10" : "bg-muted/50"
      )}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className={cn("text-sm font-bold", danger && "text-destructive")}>{title}</h4>
        <p className="text-xs text-muted-foreground/60">{description}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}
