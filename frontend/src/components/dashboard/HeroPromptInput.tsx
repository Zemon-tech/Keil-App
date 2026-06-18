"use client";

import { useState, useEffect, type ChangeEvent, type ElementType } from "react";
import {
  ArrowRight,
  FileText,
  GlobeIcon,
  Image,
  Plus,
  SearchIcon,
  Mic,
  Brain,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { getMediaCategory } from "@/components/ai-elements/attachments-utils";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputCommand,
  PromptInputCommandEmpty,
  PromptInputCommandGroup,
  PromptInputCommandInput,
  PromptInputCommandItem,
  PromptInputCommandList,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputActionMenuItem,
} from "@/components/ai-elements/prompt-input";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input-context";
import type { AttachmentData } from "@/components/ai-elements/attachments-utils";
import { cn } from "@/lib/utils";

// Models are defined dynamically based on user settings

const suggestions: {
  id: string;
  label: string;
  icon: ElementType;
  description: string;
}[] = [
  {
    id: "1",
    label: "Draft an email",
    icon: FileText,
    description: "to my team about the project update",
  },
  {
    id: "2",
    label: "Explain",
    icon: SearchIcon,
    description: "quantum computing in simple terms",
  },
  {
    id: "3",
    label: "Help me write",
    icon: FileText,
    description: "a Python function for data analysis",
  },
  {
    id: "4",
    label: "Create a",
    icon: Image,
    description: "marketing strategy for a new product",
  },
];

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  const hasVisualAttachment = attachments.files.some(
    (attachment: AttachmentData) => {
      const category = getMediaCategory(attachment);
      return category === "image" || category === "video";
    },
  );

  if (!hasVisualAttachment) {
    return (
      <Attachments variant="inline" className="w-full gap-2 px-1">
        {attachments.files.map((attachment: AttachmentData) => (
          <Attachment
            key={attachment.id}
            className="h-10 rounded-full border border-border/60 bg-background/65 pr-2 shadow-sm"
            data={attachment}
            onRemove={() => attachments.remove(attachment.id)}
          >
            <AttachmentPreview className="rounded-full bg-background/80" />
            <AttachmentInfo />
            <AttachmentRemove className="size-6 opacity-100" />
          </Attachment>
        ))}
      </Attachments>
    );
  }

  return (
    <Attachments variant="grid" className="w-full gap-3 px-1">
      {attachments.files.map((attachment: AttachmentData, index: number) => (
        <Attachment
          key={attachment.id}
          className={cn(
            "overflow-hidden border border-border/60 bg-background/65 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]",
            index === 0
              ? "size-28 rounded-[1.5rem] sm:size-36"
              : "size-20 rounded-[1.15rem] sm:size-24",
          )}
          data={attachment}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview className="bg-muted/30" />
          <AttachmentRemove className="bg-background/90 opacity-100 backdrop-blur-sm hover:bg-background" />
        </Attachment>
      ))}
    </Attachments>
  );
};

interface HeroPromptSurfaceProps {
  isChatStarted: boolean;
  onSuggestionClick: (suggestion: (typeof suggestions)[number]) => void;
  onStop?: () => void;
  setUseWebSearch: (value: boolean | ((prev: boolean) => boolean)) => void;
  setUseThinking: (value: boolean | ((prev: boolean) => boolean)) => void;
  showCommandMenu: boolean;
  status?: "submitted" | "streaming" | "ready" | "error";
  text: string;
  useWebSearch: boolean;
  useThinking: boolean;
  valueChanged: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

function HeroPromptSurface({
  isChatStarted,
  onSuggestionClick,
  onStop,
  setUseWebSearch,
  setUseThinking,
  showCommandMenu,
  status,
  text,
  useWebSearch,
  useThinking,
  valueChanged,
}: HeroPromptSurfaceProps) {
  const attachments = usePromptInputAttachments();
  const hasAttachments = attachments.files.length > 0;
  const canSubmit = Boolean(text.trim()) || hasAttachments || useWebSearch;
  const isActive = status === "submitted" || status === "streaming";

  return (
    <>
      {hasAttachments && (
        <PromptInputHeader className="px-4 pt-4 pb-0 sm:px-5 sm:pt-5">
          <PromptInputAttachmentsDisplay />
        </PromptInputHeader>
      )}

      <PromptInputBody>
        <div className="relative w-full px-4 sm:px-5">
          <PromptInputTextarea
            className={cn(
              "bg-transparent border-none px-0 text-foreground placeholder:text-muted-foreground/55 focus-visible:ring-0 resize-none font-normal transition-all duration-200",
              isChatStarted
                ? "min-h-[3.25rem] pt-3 pb-1 text-[0.95rem] max-h-36 overflow-y-auto"
                : hasAttachments
                  ? "min-h-[5rem] pt-3 pb-2 text-base sm:text-lg max-h-48 overflow-y-auto"
                  : "min-h-[5rem] pt-3 pb-2 text-[1rem] sm:text-[1.05rem] max-h-48 overflow-y-auto",
            )}
            onChange={valueChanged}
            placeholder={
              isChatStarted ? "Write a message..." : "How can I help you today?"
            }
            value={text}
          />

          {showCommandMenu && (
            <div className="absolute inset-x-0 top-full z-50 mt-3 px-0">
              <PromptInputCommand className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-popover/95 p-2 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <PromptInputCommandInput
                  className="hidden"
                  placeholder="Search commands..."
                />
                <PromptInputCommandList>
                  <PromptInputCommandEmpty>
                    No commands found.
                  </PromptInputCommandEmpty>
                  <PromptInputCommandGroup heading="Suggestions">
                    {suggestions.map((suggestion) => (
                      <PromptInputCommandItem
                        key={suggestion.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3"
                        onSelect={() => onSuggestionClick(suggestion)}
                      >
                        <div className="mt-0.5 rounded-full border border-border/60 bg-background/70 p-2">
                          <suggestion.icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {suggestion.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </span>
                        </div>
                      </PromptInputCommandItem>
                    ))}
                  </PromptInputCommandGroup>
                </PromptInputCommandList>
              </PromptInputCommand>
            </div>
          )}
        </div>
      </PromptInputBody>

      <PromptInputFooter className="border-none px-3 pb-3 pt-1 sm:px-4 sm:pb-3">
        <PromptInputTools className="flex-wrap gap-2">
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger
              className="rounded-full border border-border/60 bg-background/60 text-muted-foreground shadow-none transition-colors hover:bg-background hover:text-foreground"
              size="icon-sm"
              tooltip={{ content: "Add attachments", shortcut: "⌘U" }}
              variant="ghost"
            >
              <Plus className="size-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments label="Add photos or files" />
              <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); setUseThinking(!useThinking); }}>
                <Brain className="mr-2 size-4" />
                {useThinking ? "Disable Thinking" : "Enable Thinking"}
              </PromptInputActionMenuItem>
              <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); setUseWebSearch(!useWebSearch); }}>
                <GlobeIcon className="mr-2 size-4" />
                {useWebSearch ? "Disable Web Search" : "Enable Web Search"}
              </PromptInputActionMenuItem>
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
        </PromptInputTools>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-5 w-px bg-border/60 sm:block" />

          <PromptInputButton
            className="rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            size="icon-sm"
            tooltip={{ content: "Voice input", shortcut: "⌘M" }}
            variant="ghost"
          >
            <Mic className="size-4" />
          </PromptInputButton>

          {isActive ? (
            <PromptInputSubmit
              className="rounded-full bg-foreground text-background shadow-none transition-transform hover:scale-[1.02] hover:bg-foreground/92"
              status={status}
              onClick={onStop}
              type="button"
              variant="ghost"
            />
          ) : canSubmit ? (
            <PromptInputSubmit
              className="rounded-full bg-foreground text-background shadow-none transition-transform hover:scale-[1.02] hover:bg-foreground/92"
              status={status}
              variant="ghost"
            />
          ) : (
            <PromptInputButton
              className="rounded-full bg-foreground text-background shadow-none transition-transform hover:scale-[1.02] hover:bg-foreground/92"
              size="icon-sm"
              variant="ghost"
            >
              <ArrowRight className="size-4" />
            </PromptInputButton>
          )}
        </div>
      </PromptInputFooter>
    </>
  );
}

interface HeroPromptInputProps {
  isChatStarted?: boolean;
  onSubmit?: (message: PromptInputMessage) => void;
  status?: "submitted" | "streaming" | "ready" | "error";
  onStop?: () => void;
}

export function HeroPromptInput({
  isChatStarted = false,
  onSubmit,
  status,
  onStop,
}: HeroPromptInputProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    const greetings = [];
    if (hour < 12) greetings.push("Good morning", "Rise and shine", "Ready for the day");
    else if (hour < 18) greetings.push("Good afternoon", "Hope your day is going well");
    else greetings.push("Good evening", "Winding down", "Still at it");

    // We can add more context like day of the week
    const day = new Date().getDay();
    if (day === 1 && hour < 12) greetings.push("Happy Monday", "Let's conquer this week");
    if (day === 5 && hour > 14) greetings.push("Happy Friday", "Almost the weekend");

    // Pick a random greeting
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    return `${greeting}, ${userName.split(" ")[0]}`;
  };

  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    setGreeting(getDynamicGreeting());
  }, [userName]);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments || useWebSearch)) {
      return;
    }

    onSubmit?.(message);
    setText("");
    setShowCommandMenu(false);
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    setShowCommandMenu(value.startsWith("/") && value.length > 0);
  };

  const handleSuggestionClick = (suggestion: (typeof suggestions)[number]) => {
    setText(`${suggestion.label} ${suggestion.description}`);
    setShowCommandMenu(false);
  };

  return (
    <section
      className={cn(
        "relative flex w-full max-w-[54rem] flex-col items-center px-4",
        isChatStarted ? "gap-0 py-4" : "gap-6 pt-12 sm:gap-7 sm:pt-14",
      )}
    >
      {!isChatStarted && (
        <div className="flex items-center gap-5 text-center">
          <h1 className="text-4xl font-medium tracking-tight font-serif text-white sm:text-5xl md:text-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {greeting || `Hey, ${userName.split(" ")[0]}`}
          </h1>
        </div>
      )}

      <div className="w-full max-w-[54rem]">
        <PromptInput
          className={cn(
            "w-full overflow-visible bg-transparent",
            "[&_[data-slot=input-group]]:relative [&_[data-slot=input-group]]:overflow-visible",
            isChatStarted
              ? "[&_[data-slot=input-group]]:rounded-[1.35rem]"
              : "[&_[data-slot=input-group]]:rounded-[1.25rem]",
            "[&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-border/70",
            "[&_[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:border-border/70",
            "[&_[data-slot=input-group]]:bg-background/88",
            isChatStarted
              ? "[&_[data-slot=input-group]]:shadow-[0_18px_55px_-36px_rgba(15,23,42,0.4)]"
              : "[&_[data-slot=input-group]]:shadow-[0_26px_70px_-42px_rgba(15,23,42,0.28)]",
            "[&_[data-slot=input-group]]:backdrop-blur-xl",
            "transition-all duration-300 dark:shadow-[0_30px_80px_-42px_rgba(0,0,0,0.65)]",
            "[&_[data-slot=input-group]]:before:pointer-events-none [&_[data-slot=input-group]]:before:absolute [&_[data-slot=input-group]]:before:inset-x-6 [&_[data-slot=input-group]]:before:top-0 [&_[data-slot=input-group]]:before:h-px [&_[data-slot=input-group]]:before:bg-white/10 [&_[data-slot=input-group]]:before:content-['']",
          )}
          globalDrop
          multiple
          onSubmit={handleSubmit}
        >
          <HeroPromptSurface
            isChatStarted={isChatStarted}
            onSuggestionClick={handleSuggestionClick}
            onStop={onStop}
            setUseWebSearch={setUseWebSearch}
            setUseThinking={setUseThinking}
            showCommandMenu={showCommandMenu}
            status={status}
            text={text}
            useWebSearch={useWebSearch}
            useThinking={useThinking}
            valueChanged={handleTextChange}
          />
        </PromptInput>
      </div>
    </section>
  );
}
