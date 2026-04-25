"use client";

import { useState, type ChangeEvent, type ElementType } from "react";
import {
  ArrowUp,
  ArrowRight,
  FileText,
  Ghost,
  GlobeIcon,
  Image,
  Plus,
  SearchIcon,
  Mic
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  getMediaCategory,
} from "@/components/ai-elements/attachments";
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
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

const models = [
  { id: "sonnet-4.6", name: "Sonnet 4.6 Extended" },
  { id: "opus-3", name: "Claude 3 Opus" },
  { id: "gpt-4o", name: "GPT-4o" },
];

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

  const hasVisualAttachment = attachments.files.some((attachment) => {
    const category = getMediaCategory(attachment);
    return category === "image" || category === "video";
  });

  if (!hasVisualAttachment) {
    return (
      <Attachments variant="inline" className="w-full gap-2 px-1">
        {attachments.files.map((attachment) => (
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
      {attachments.files.map((attachment, index) => (
        <Attachment
          key={attachment.id}
          className={cn(
            "overflow-hidden border border-border/60 bg-background/65 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]",
            index === 0
              ? "size-28 rounded-[1.5rem] sm:size-36"
              : "size-20 rounded-[1.15rem] sm:size-24"
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
  model: string;
  onSuggestionClick: (suggestion: (typeof suggestions)[number]) => void;
  setModel: (value: string) => void;
  setUseWebSearch: (value: boolean | ((prev: boolean) => boolean)) => void;
  showCommandMenu: boolean;
  text: string;
  useWebSearch: boolean;
  valueChanged: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

function HeroPromptSurface({
  model,
  onSuggestionClick,
  setModel,
  setUseWebSearch,
  showCommandMenu,
  text,
  useWebSearch,
  valueChanged,
}: HeroPromptSurfaceProps) {
  const attachments = usePromptInputAttachments();
  const hasAttachments = attachments.files.length > 0;
  const canSubmit = Boolean(text.trim()) || hasAttachments || useWebSearch;

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
              hasAttachments
                ? "min-h-[5rem] pt-3 pb-2 text-base sm:text-lg max-h-48 overflow-y-auto"
                : "min-h-[5rem] pt-3 pb-2 text-[1rem] sm:text-[1.05rem] max-h-48 overflow-y-auto"
            )}
            onChange={valueChanged}
            placeholder="How can I help you today?"
            value={text}
          />

          {text && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-8 bg-gradient-to-t from-background/90 via-background/50 to-transparent sm:inset-x-5" />
          )}

          {showCommandMenu && (
            <div className="absolute inset-x-0 top-full z-50 mt-3 px-0">
              <PromptInputCommand className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-popover/95 p-2 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <PromptInputCommandInput className="hidden" placeholder="Search commands..." />
                <PromptInputCommandList>
                  <PromptInputCommandEmpty>No commands found.</PromptInputCommandEmpty>
                  <PromptInputCommandGroup heading="Suggestions">
                    {suggestions.map((suggestion) => (
                      <PromptInputCommandItem
                        key={suggestion.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3"
                        onSelect={() => onSuggestionClick(suggestion)}
                      >
                        <div className="mt-0.5 rounded-full border border-border/60 bg-background/70 p-2">
                          <suggestion.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{suggestion.label}</span>
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
              <Plus className="h-4 w-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments label="Add photos or files" />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>

          <PromptInputButton
            className={cn(
              "rounded-full border px-3 text-[13px] shadow-none transition-all",
              useWebSearch
                ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border/60 bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground"
            )}
            onClick={() => setUseWebSearch((value) => !value)}
            tooltip={{ content: "Search the web", shortcut: "⌘K" }}
            variant="ghost"
          >
            <GlobeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Web</span>
          </PromptInputButton>

          <PromptInputSelect onValueChange={setModel} value={model}>
            <PromptInputSelectTrigger className="rounded-full border border-border/60 bg-background/60 px-3 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-0">
              <PromptInputSelectValue />
            </PromptInputSelectTrigger>
            <PromptInputSelectContent>
              {models.map((item) => (
                <PromptInputSelectItem key={item.id} value={item.id}>
                  {item.name}
                </PromptInputSelectItem>
              ))}
            </PromptInputSelectContent>
          </PromptInputSelect>
        </PromptInputTools>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-5 w-px bg-border/60 sm:block" />

          <PromptInputButton
            className="rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            size="icon-sm"
            tooltip={{ content: "Voice input", shortcut: "⌘M" }}
            variant="ghost"
          >
            <Mic className="h-4 w-4" />
          </PromptInputButton>

          {canSubmit ? (
            <PromptInputSubmit
              className="rounded-full bg-foreground text-background shadow-none transition-transform hover:scale-[1.02] hover:bg-foreground/92"
              variant="ghost"
            >
              <ArrowUp className="h-4 w-4" />
            </PromptInputSubmit>
          ) : (
            <PromptInputButton
              className="rounded-full bg-foreground text-background shadow-none transition-transform hover:scale-[1.02] hover:bg-foreground/92"
              size="icon-sm"
              variant="ghost"
            >
              <ArrowRight className="h-4 w-4" />
            </PromptInputButton>
          )}
        </div>
      </PromptInputFooter>
    </>
  );
}

interface HeroPromptInputProps {
  onSubmit?: (message: PromptInputMessage) => void;
}

export function HeroPromptInput({ onSubmit }: HeroPromptInputProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [model, setModel] = useState(models[0].id);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  const userName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

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
    <section className="relative flex w-full max-w-4xl flex-col items-center gap-6 px-4 pt-12 sm:gap-7 sm:pt-14">
      <div className="fixed top-6 right-6 text-muted-foreground/55 transition-colors hover:text-foreground">
        <Ghost className="h-6 w-6" />
      </div>

      <div className="flex items-center gap-5 text-center">
        <h1 className="text-4xl font-medium tracking-tight font-serif text-foreground sm:text-5xl md:text-6xl">
          Hey, {userName}
        </h1>
      </div>

      <div className="w-full max-w-[54rem]">
        <PromptInput
          className={cn(
            "w-full overflow-visible bg-transparent",
            "[&_[data-slot=input-group]]:relative [&_[data-slot=input-group]]:overflow-visible",
            "[&_[data-slot=input-group]]:rounded-[1.25rem] [&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-border/70",
            "[&_[data-slot=input-group]]:bg-background/88",
            "[&_[data-slot=input-group]]:shadow-[0_26px_70px_-42px_rgba(15,23,42,0.28)] [&_[data-slot=input-group]]:backdrop-blur-xl",
            "transition-all duration-300 dark:shadow-[0_30px_80px_-42px_rgba(0,0,0,0.65)]",
            "[&_[data-slot=input-group]]:before:pointer-events-none [&_[data-slot=input-group]]:before:absolute [&_[data-slot=input-group]]:before:inset-x-6 [&_[data-slot=input-group]]:before:top-0 [&_[data-slot=input-group]]:before:h-px [&_[data-slot=input-group]]:before:bg-white/10 [&_[data-slot=input-group]]:before:content-['']"
          )}
          globalDrop
          multiple
          onSubmit={handleSubmit}
        >
          <HeroPromptSurface
            model={model}
            onSuggestionClick={handleSuggestionClick}
            setModel={setModel}
            setUseWebSearch={setUseWebSearch}
            showCommandMenu={showCommandMenu}
            text={text}
            useWebSearch={useWebSearch}
            valueChanged={handleTextChange}
          />
        </PromptInput>
      </div>
    </section>
  );
}
