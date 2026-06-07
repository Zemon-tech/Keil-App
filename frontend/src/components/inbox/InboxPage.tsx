import { useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Mail, 
  Search, 
  Plus, 
  FileText, 
  Sparkles, 
  Loader2, 
  RefreshCw,
  ChevronRight,
  Inbox
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
}

interface EmailDetails extends EmailSummary {
  body: string;
}

export function InboxPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // 1. Query recent emails
  const { 
    data: emails = [], 
    isLoading, 
    isError, 
    error, 
    refetch,
    isRefetching
  } = useQuery<EmailSummary[], any>({
    queryKey: ["gmail-inbox", deferredSearchQuery],
    queryFn: async () => {
      const res = await api.get<{ data: EmailSummary[] }>("v1/gmail/inbox", {
        params: deferredSearchQuery ? { query: deferredSearchQuery } : {},
      });
      return res.data.data;
    },
    retry: false,
    staleTime: 30000,
  });

  // 2. Query selected email details
  const { 
    data: selectedEmail, 
    isLoading: isLoadingDetails,
    isError: isDetailsError
  } = useQuery<EmailDetails>({
    queryKey: ["gmail-message", selectedId],
    queryFn: async () => {
      if (!selectedId) throw new Error("No email selected");
      const res = await api.get<{ data: EmailDetails }>(`v1/gmail/messages/${selectedId}`);
      return res.data.data;
    },
    enabled: !!selectedId,
    staleTime: 60000,
  });

  // 3. Initiate Google OAuth Flow (inc. Gmail scope)
  const handleConnectGmail = async () => {
    try {
      const res = await api.get<{ data: { url: string } }>("v1/integrations/google/connect");
      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
      } else {
        toast.error("Failed to generate Google connection URL");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to Google API");
    }
  };

  // 4. Handle Mock Button Clicks
  const triggerDemoAction = (actionName: string, threadSubject: string) => {
    const messages = {
      task: `Demo Action: Converting email "${threadSubject}" to a KielHQ task...`,
      doc: `Demo Action: Saving conversation to a new KielHQ Motion doc...`,
      summary: `Demo Action: Summarizing thread context with Gemini...`
    };
    
    toast.info(messages[actionName as keyof typeof messages] || "Running action...", {
      description: "This feature is currently configured as a prototype button.",
      duration: 5000,
    });
  };

  // If OAuth error (403 indicates integration is missing or has revoked scopes)
  const isAuthError = isError && error?.response?.status === 403;

  if (isAuthError) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="size-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto text-violet-400">
            <Mail className="size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Connect your Gmail Inbox</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Read customer and partner emails directly inside KielHQ. Easily turn messages into task cards, document specs, or summaries with one click.
            </p>
          </div>
          <Button 
            onClick={handleConnectGmail}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 rounded-xl transition-all shadow-lg shadow-violet-500/10"
          >
            Connect Google Mail
            <ChevronRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden">
      {/* LEFT COLUMN: List of Emails */}
      <div className="w-[380px] border-r border-border flex flex-col h-full bg-card/30 min-h-0">
        <div className="p-4 border-b border-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Inbox className="size-5 text-violet-400" />
              Inbox
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
            >
              <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border text-xs rounded-xl focus-visible:ring-violet-500/20"
            />
          </div>
        </div>

        {/* Email list container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
              <Loader2 className="size-6 animate-spin text-violet-500" />
              <span className="text-xs">Fetching inbox...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-400 space-y-3 text-center px-4 border border-red-500/10 rounded-xl bg-red-500/5 m-2">
              <span className="text-xs font-semibold">Error Syncing Inbox</span>
              <p className="text-[10px] text-zinc-400 max-w-[280px] leading-relaxed break-words">
                {error?.response?.data?.message || error?.message || "An unexpected error occurred."}
              </p>
              <Button size="sm" variant="outline" className="text-xs h-8 border-red-500/20 hover:bg-red-500/10 text-zinc-300 font-semibold" onClick={() => refetch()}>
                Retry Connection
              </Button>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2 text-center px-4">
              <Mail className="size-8 text-zinc-700" />
              <span className="text-xs font-medium text-zinc-500">No emails found</span>
              <span className="text-[10px] text-zinc-600">Your Google Mail inbox is empty.</span>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = selectedId === email.id;
              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedId(email.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex flex-col gap-1.5 ${
                    isSelected 
                      ? "bg-muted border-violet-500/30 shadow-md shadow-violet-500/5" 
                      : "bg-transparent border-transparent hover:bg-muted/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded-full bg-violet-500/10 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                        {email.fromName[0]?.toUpperCase() || "M"}
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {email.fromName}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium whitespace-nowrap">
                      {email.date ? new Date(email.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ""}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <h2 className={`text-xs font-semibold truncate ${isSelected ? "text-foreground" : "text-foreground/80"}`}>
                      {email.subject}
                    </h2>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {email.snippet}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Reader Pane */}
      <div className="flex-1 flex flex-col h-full bg-background min-h-0">
        {selectedId ? (
          isLoadingDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-3">
              <Loader2 className="size-8 animate-spin text-violet-500" />
              <span className="text-xs">Loading email content...</span>
            </div>
          ) : isDetailsError || !selectedEmail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-destructive space-y-2">
              <span className="text-xs font-medium">Failed to retrieve email body.</span>
              <Button size="sm" variant="outline" onClick={() => setSelectedId(selectedId)}>Retry</Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden animate-in fade-in duration-200">
              {/* Toolbar Header */}
              <div className="p-4 border-b border-border bg-card/30 flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-base font-bold text-foreground truncate">
                    {selectedEmail.subject}
                  </h1>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="font-semibold text-zinc-300">{selectedEmail.fromName}</span>
                    <span>&lt;{selectedEmail.fromEmail}&gt;</span>
                    <span>•</span>
                    <span>{selectedEmail.date}</span>
                  </div>
                </div>

                {/* Dummy Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => triggerDemoAction("task", selectedEmail.subject)}
                    className="h-8 rounded-lg text-[11px] border-border hover:bg-muted font-semibold gap-1.5 cursor-pointer text-foreground"
                  >
                    <Plus className="size-3.5 text-green-500" />
                    Email to Task
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => triggerDemoAction("doc", selectedEmail.subject)}
                    className="h-8 rounded-lg text-[11px] border-border hover:bg-muted font-semibold gap-1.5 cursor-pointer text-foreground"
                  >
                    <FileText className="size-3.5 text-blue-500" />
                    Email to Doc
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => triggerDemoAction("summary", selectedEmail.subject)}
                    className="h-8 rounded-lg text-[11px] border-border hover:bg-muted font-semibold gap-1.5 cursor-pointer text-foreground"
                  >
                    <Sparkles className="size-3.5 text-yellow-500" />
                    Summary
                  </Button>
                </div>
              </div>

              {/* Email Content Frame */}
              <div className="flex-1 min-h-0 p-4 overflow-hidden flex">
                <iframe
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="color-scheme" content="${isDark ? "dark" : "light"}">
                        <style>
                          :root {
                            color-scheme: ${isDark ? "dark" : "light"};
                          }
                          body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            color: ${isDark ? "#d4d4d8" : "#1f2937"};
                            background-color: ${isDark ? "#09090b" : "#ffffff"};
                            line-height: 1.6;
                            margin: 0;
                            padding: 24px;
                          }
                          a { color: ${isDark ? "#a78bfa" : "#6d28d9"}; text-decoration: underline; }
                          a:hover { color: ${isDark ? "#c084fc" : "#4c1d95"}; }
                          img { max-width: 100%; height: auto; border-radius: 8px; }
                          blockquote { border-left: 3px solid ${isDark ? "#3f3f46" : "#e5e7eb"}; padding-left: 16px; color: ${isDark ? "#a1a1aa" : "#4b5563"}; margin: 16px 0; }
                          pre { background-color: ${isDark ? "#18181b" : "#f3f4f6"}; padding: 12px; border-radius: 6px; overflow-x: auto; color: ${isDark ? "#e4e4e7" : "#1f2937"}; }
                          table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                          th, td { border: 1px solid ${isDark ? "#27272a" : "#e5e7eb"}; padding: 8px 12px; text-align: left; }
                          th { background-color: ${isDark ? "#18181b" : "#f3f4f6"}; }
                        </style>
                      </head>
                      <body>
                        ${selectedEmail.body || `<p style="color: ${isDark ? "#71717a" : "#9ca3af"};">${selectedEmail.snippet}</p>`}
                      </body>
                    </html>
                  `}
                  className="w-full h-full border border-border bg-background rounded-xl"
                  title="Email Body"
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="size-16 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground/60">
              <Mail className="size-6" />
            </div>
            <div className="text-center space-y-1">
              <span className="text-xs font-semibold text-foreground/80 block">No conversation selected</span>
              <span className="text-[10px] text-muted-foreground block">Choose an email thread from the inbox to read its context.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
