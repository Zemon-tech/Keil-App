import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft,
    User,
    SlidersHorizontal,
    Sparkles,
    Bot,
    Keyboard,
    ListTodo,
    Bell,
    Plug,
    Code2,
    Building2,
    LogOut,
    ChevronRight,
    Shield,
    Palette,
    Globe,
    Monitor,
    Moon,
    Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

// ─── Settings Tabs ───────────────────────────────────────────────────
type SettingsTab =
    | "account"
    | "preferences"
    | "personalization"
    | "assistant"
    | "shortcuts"
    | "tasks"
    | "notifications"
    | "connectors"
    | "api"
    | "enterprise";

interface SettingsNavItem {
    id: SettingsTab;
    label: string;
    icon: React.ElementType;
    group: "account" | "workspace";
}

const settingsNavItems: SettingsNavItem[] = [
    { id: "account", label: "Account", icon: User, group: "account" },
    { id: "preferences", label: "Preferences", icon: SlidersHorizontal, group: "account" },
    { id: "personalization", label: "Personalization", icon: Sparkles, group: "account" },
    { id: "assistant", label: "Assistant", icon: Bot, group: "account" },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard, group: "account" },
    { id: "tasks", label: "Tasks", icon: ListTodo, group: "account" },
    { id: "notifications", label: "Notifications", icon: Bell, group: "account" },
    { id: "connectors", label: "Connectors", icon: Plug, group: "account" },
    { id: "api", label: "API", icon: Code2, group: "workspace" },
    { id: "enterprise", label: "Enterprise", icon: Building2, group: "workspace" },
];

// ─── Tab Content Components ──────────────────────────────────────────

function AccountTab() {
    const { user, signOut } = useAuth();
    const userDisplayName = user?.user_metadata?.full_name || user?.email || "User";
    const userEmail = user?.email || "";
    const userInitials = user?.user_metadata?.full_name
        ?.split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase() || user?.email?.[0].toUpperCase() || "U";

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Account</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your account information and security settings.</p>
            </div>

            <Separator />

            {/* Profile Section */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 rounded-full">
                        <AvatarFallback className="rounded-full bg-emerald-600 text-white text-lg font-semibold">
                            {userInitials}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{userDisplayName}</p>
                        <p className="text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                    Change avatar
                </Button>
            </div>

            <Separator />

            {/* Full Name */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Full Name</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{userDisplayName}</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                    Change full name
                </Button>
            </div>

            <Separator />

            {/* Username */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Username</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{userEmail?.split("@")[0]}</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                    Change username
                </Button>
            </div>

            <Separator />

            {/* Email */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                </div>
            </div>

            <Separator />

            {/* Security */}
            <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Security
                </h3>
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">Password</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Set a password or change your existing one</p>
                        </div>
                        <Button variant="outline" size="sm" className="text-xs rounded-lg">
                            Change password
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security to your account</p>
                        </div>
                        <Switch />
                    </div>
                </div>
            </div>

            <Separator />

            {/* Sign Out */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Sign Out</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You are signed in as {userEmail}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800/40"
                    onClick={signOut}
                >
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    Sign out
                </Button>
            </div>
        </div>
    );
}

function PreferencesTab() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
                <p className="text-sm text-muted-foreground mt-1">Customize how KeilHQ works for you.</p>
            </div>

            <Separator />

            {/* Theme */}
            <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Appearance
                </h3>
                <div className="mt-4 grid grid-cols-3 gap-3">
                    <button
                        onClick={() => setTheme("light")}
                        className={cn(
                            "flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                            theme === "light"
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                        )}
                    >
                        <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                            <Sun className="h-5 w-5 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium text-foreground">Light</span>
                    </button>
                    <button
                        onClick={() => setTheme("dark")}
                        className={cn(
                            "flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                            theme === "dark"
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                        )}
                    >
                        <div className="h-10 w-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shadow-sm">
                            <Moon className="h-5 w-5 text-indigo-400" />
                        </div>
                        <span className="text-xs font-medium text-foreground">Dark</span>
                    </button>
                    <button
                        onClick={() => setTheme("system")}
                        className={cn(
                            "flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                            theme === "system"
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                        )}
                    >
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-white to-slate-900 border border-slate-300 flex items-center justify-center shadow-sm">
                            <Monitor className="h-5 w-5 text-slate-500" />
                        </div>
                        <span className="text-xs font-medium text-foreground">System</span>
                    </button>
                </div>
            </div>

            <Separator />

            {/* Language */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium text-foreground">Language</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Choose the language used in the interface</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                    English
                    <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
            </div>

            <Separator />

            {/* Density */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Compact Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Reduce spacing in the interface for denser layout</p>
                </div>
                <Switch />
            </div>

            <Separator />

            {/* Animations */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Reduce Animations</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Minimize motion for a calmer experience</p>
                </div>
                <Switch />
            </div>
        </div>
    );
}

function PersonalizationTab() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Personalization</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell KeilHQ about yourself for a better experience.</p>
            </div>

            <Separator />

            <div>
                <Label htmlFor="role" className="text-sm font-medium">Your Role</Label>
                <Input id="role" placeholder="e.g., Product Manager, Developer" className="mt-2 rounded-lg" />
                <p className="text-xs text-muted-foreground mt-1.5">This helps tailor the dashboard to your needs.</p>
            </div>

            <div>
                <Label htmlFor="team" className="text-sm font-medium">Team / Department</Label>
                <Input id="team" placeholder="e.g., Engineering, Design" className="mt-2 rounded-lg" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Smart Suggestions</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Get AI-powered suggestions based on your workflow</p>
                </div>
                <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Daily Digest</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Receive a summary of your day each morning</p>
                </div>
                <Switch defaultChecked />
            </div>
        </div>
    );
}

function AssistantTab() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Assistant</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure your AI assistant preferences.</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">AI Assistant</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Get intelligent help across all features</p>
                </div>
                <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Auto-complete</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Suggest completions as you type</p>
                </div>
                <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Context Awareness</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Allow the assistant to understand your current context</p>
                </div>
                <Switch defaultChecked />
            </div>
        </div>
    );
}

function ShortcutsTab() {
    const shortcuts = [
        { keys: ["⌘", "K"], action: "Open command palette" },
        { keys: ["⌘", "B"], action: "Toggle sidebar" },
        { keys: ["⌘", "N"], action: "New item" },
        { keys: ["⌘", "⇧", "P"], action: "Open settings" },
        { keys: ["⌘", "/"], action: "Toggle assistant" },
        { keys: ["⌘", "D"], action: "Go to dashboard" },
        { keys: ["Esc"], action: "Close dialog / cancel" },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Shortcuts</h2>
                <p className="text-sm text-muted-foreground mt-1">Keyboard shortcuts to help you work faster.</p>
            </div>

            <Separator />

            <div className="space-y-1">
                {shortcuts.map((shortcut, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                        <span className="text-sm text-foreground">{shortcut.action}</span>
                        <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, j) => (
                                <kbd
                                    key={j}
                                    className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-md border border-border bg-muted/70 text-[11px] font-mono font-medium text-muted-foreground"
                                >
                                    {key}
                                </kbd>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TasksTab() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure task defaults and behavior.</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Auto-assign to me</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Automatically assign new tasks to yourself</p>
                </div>
                <Switch />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Due date reminders</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Get notified before a task is due</p>
                </div>
                <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Show completed tasks</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Keep completed tasks visible in lists</p>
                </div>
                <Switch />
            </div>
        </div>
    );
}

function NotificationsTab() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose what you want to be notified about.</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Push Notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Receive push notifications in your browser</p>
                </div>
                <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Email Notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Get notified via email for important updates</p>
                </div>
                <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Sound</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Play a sound when you receive a notification</p>
                </div>
                <Switch />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Task mentions</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Notify when someone mentions you in a task</p>
                </div>
                <Switch defaultChecked />
            </div>
        </div>
    );
}

function ConnectorsTab() {
    const connectors = [
        { name: "GitHub", description: "Connect your repositories", connected: true },
        { name: "Slack", description: "Send notifications to Slack", connected: false },
        { name: "Jira", description: "Sync tasks with Jira", connected: false },
        { name: "Figma", description: "View design files inline", connected: false },
        { name: "Google Calendar", description: "Sync deadlines and events", connected: true },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Connectors</h2>
                <p className="text-sm text-muted-foreground mt-1">Connect third-party services to enhance your workflow.</p>
            </div>

            <Separator />

            <div className="space-y-3">
                {connectors.map((connector, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Plug className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{connector.name}</p>
                                <p className="text-xs text-muted-foreground">{connector.description}</p>
                            </div>
                        </div>
                        <Button
                            variant={connector.connected ? "outline" : "default"}
                            size="sm"
                            className="text-xs rounded-lg"
                        >
                            {connector.connected ? "Disconnect" : "Connect"}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ApiTab() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">API</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage API keys and integrations.</p>
            </div>

            <Separator />

            <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-foreground">API Key</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Your secret API key for programmatic access</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs rounded-lg">
                        Generate new key
                    </Button>
                </div>
                <div className="mt-4">
                    <div className="flex items-center gap-2">
                        <Input
                            value="sk-••••••••••••••••••••••••"
                            readOnly
                            className="font-mono text-xs rounded-lg bg-muted/50"
                        />
                        <Button variant="outline" size="sm" className="text-xs rounded-lg shrink-0">
                            Copy
                        </Button>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Webhook URL</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Receive real-time event notifications</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                    Configure
                </Button>
            </div>
        </div>
    );
}

function EnterpriseTab() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Enterprise</h2>
                <p className="text-sm text-muted-foreground mt-1">Enterprise features and team management.</p>
            </div>

            <Separator />

            <div className="p-6 rounded-xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground">Upgrade to Enterprise</h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Get access to SSO, advanced analytics, audit logs, and priority support.
                </p>
                <Button size="sm" className="mt-4 rounded-lg text-xs">
                    Contact Sales
                </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Team Members</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage who has access to your workspace</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                    Manage team
                    <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
            </div>
        </div>
    );
}

// ─── Tab Content Map ─────────────────────────────────────────────────
const tabContent: Record<SettingsTab, React.FC> = {
    account: AccountTab,
    preferences: PreferencesTab,
    personalization: PersonalizationTab,
    assistant: AssistantTab,
    shortcuts: ShortcutsTab,
    tasks: TasksTab,
    notifications: NotificationsTab,
    connectors: ConnectorsTab,
    api: ApiTab,
    enterprise: EnterpriseTab,
};

// ─── Main Settings Dialog ────────────────────────────────────────────
interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>("account");
    const ActiveContent = tabContent[activeTab];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Settings</DialogTitle>
                </VisuallyHidden.Root>

                <div className="flex h-full w-full overflow-hidden rounded-2xl">
                    {/* ── Sidebar ─────────────────────────────────── */}
                    <aside className="w-[240px] shrink-0 border-r border-border bg-sidebar flex flex-col h-full rounded-l-2xl">
                        {/* Back / Home */}
                        <div className="p-4 pb-2">
                            <button
                                onClick={() => onOpenChange(false)}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                            >
                                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                                <span className="font-medium">Home</span>
                            </button>
                        </div>

                        {/* Nav Groups */}
                        <nav className="flex-1 overflow-y-auto px-3 py-2">
                            {/* Account section */}
                            <div className="mb-4">
                                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                    Account
                                </p>
                                {settingsNavItems
                                    .filter((item) => item.group === "account")
                                    .map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
                                                    activeTab === item.id
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                )}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" />
                                                {item.label}
                                            </button>
                                        );
                                    })}
                            </div>

                            {/* Workspace section */}
                            <div>
                                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                    Workspace
                                </p>
                                {settingsNavItems
                                    .filter((item) => item.group === "workspace")
                                    .map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
                                                    activeTab === item.id
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                )}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" />
                                                {item.label}
                                                {item.id === "enterprise" && (
                                                    <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
                                                )}
                                            </button>
                                        );
                                    })}
                            </div>
                        </nav>
                    </aside>

                    {/* ── Main Content ────────────────────────────── */}
                    <main className="flex-1 overflow-y-auto bg-background">
                        <div className="max-w-2xl mx-auto px-8 py-10">
                            <ActiveContent />
                        </div>
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    );
}
