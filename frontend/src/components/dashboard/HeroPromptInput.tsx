"use client";

import { useState } from "react";
import { Ghost, Plus, AudioLines, GlobeIcon, SearchIcon, FileText, Image } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
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
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
  PromptInputTabsList,
  PromptInputTab,
  PromptInputTabLabel,
  PromptInputTabBody,
  PromptInputTabItem,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";

const models = [
  { id: "sonnet-4.6", name: "Sonnet 4.6 Extended" },
  { id: "opus-3", name: "Claude 3 Opus" },
  { id: "gpt-4o", name: "GPT-4o" },
];

const suggestions = [
  { id: "1", label: "Draft an email", icon: FileText, description: "to my team about the project update" },
  { id: "2", label: "Explain", icon: SearchIcon, description: "quantum computing in simple terms" },
  { id: "3", label: "Help me write", icon: FileText, description: "a Python function for data analysis" },
  { id: "4", label: "Create a", icon: Image, description: "marketing strategy for a new product" },
];

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="grid" className="px-6 pt-4">
      {attachments.files.map((attachment) => (
        <Attachment
          key={attachment.id}
          data={attachment}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
};

interface HeroPromptInputProps {
  onSubmit?: (message: PromptInputMessage) => void;
}

export function HeroPromptInput({ onSubmit }: HeroPromptInputProps) {
  const { user } = useAuth();
  const [text, setText] = useState<string>("");
  const [model, setModel] = useState<string>(models[0].id);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [showCommandMenu, setShowCommandMenu] = useState<boolean>(false);

  const userName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    onSubmit?.(message);
    setText("");
    setShowCommandMenu(false);
  };

  const handleSuggestionClick = (suggestion: typeof suggestions[0]) => {
    setText(`${suggestion.label} ${suggestion.description}`);
    setShowCommandMenu(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    setShowCommandMenu(value.startsWith("/") && value.length > 0);
  };

  return (
    <section className="w-full max-w-4xl flex flex-col items-center gap-10 relative px-4 pt-16">
      {/* Ghost icon - Top right corner of screen */}
      <div className="fixed top-6 right-6 text-muted-foreground/60 hover:text-foreground transition-colors">
        <Ghost className="h-6 w-6" />
      </div>

      {/* Greeting */}
      <div className="flex items-center gap-5 text-center">
        <h1 className="text-5xl md:text-6xl font-medium tracking-tight font-serif text-foreground">
          Hey, {userName}
        </h1>
      </div>

      {/* Enhanced Chat input using PromptInput */}
      <div className="w-full max-w-3xl">
        <PromptInput
          onSubmit={handleSubmit}
          className="w-full rounded-2xl border border-border/60 bg-card/90 shadow-lg overflow-hidden"
          multiple
          globalDrop
        >
          <PromptInputHeader>
            <PromptInputAttachmentsDisplay />
          </PromptInputHeader>
          
          <PromptInputBody className="relative">
            <PromptInputTextarea
              placeholder="How can I help you today?"
              className="min-h-[88px] bg-transparent border-none px-6 pt-5 pb-4 text-[15px] sm:text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 resize-none font-normal"
              value={text}
              onChange={handleTextChange}
            />
            
            {/* Command Menu for suggestions */}
            {showCommandMenu && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50">
                <PromptInputCommand className="rounded-lg border shadow-md bg-popover">
                  <PromptInputCommandInput 
                    placeholder="Search commands..." 
                    className="hidden"
                  />
                  <PromptInputCommandList>
                    <PromptInputCommandEmpty>No commands found.</PromptInputCommandEmpty>
                    <PromptInputCommandGroup heading="Suggestions">
                      {suggestions.map((suggestion) => (
                        <PromptInputCommandItem
                          key={suggestion.id}
                          onSelect={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        >
                          <suggestion.icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">{suggestion.label}</span>
                            <span className="text-xs text-muted-foreground">{suggestion.description}</span>
                          </div>
                        </PromptInputCommandItem>
                      ))}
                    </PromptInputCommandGroup>
                  </PromptInputCommandList>
                </PromptInputCommand>
              </div>
            )}
          </PromptInputBody>
          
          <PromptInputFooter className="px-6 pb-4 pt-0 border-none flex justify-between items-center text-xs text-muted-foreground">
            <PromptInputTools>
              {/* Action Menu with Attachments */}
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger 
                  tooltip={{ content: "Add attachments", shortcut: "⌘U" }}
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 rounded-full transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label="Add photos or files" />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              {/* Web Search Button with Tooltip */}
              <PromptInputButton
                onClick={() => setUseWebSearch(!useWebSearch)}
                tooltip={{ content: "Search the web", shortcut: "⌘K" }}
                variant={useWebSearch ? "default" : "ghost"}
                size="icon-sm"
                className="h-8 w-8 rounded-full transition-colors"
              >
                <GlobeIcon className="h-4 w-4" />
              </PromptInputButton>

              {/* Model Selector with HoverCard */}
              <PromptInputHoverCard>
                <PromptInputHoverCardTrigger asChild>
                  <PromptInputSelect
                    value={model}
                    onValueChange={setModel}
                  >
                    <PromptInputSelectTrigger className="bg-muted/40 border border-border/60 h-8 px-3 rounded-full text-[12px] font-medium text-muted-foreground/80 hover:text-foreground hover:bg-muted/60 gap-1.5 shadow-none focus-visible:ring-0">
                      <PromptInputSelectValue />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      <PromptInputTabsList className="flex gap-2 px-2 py-2 border-b">
                        <PromptInputTab className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                          Models
                        </PromptInputTab>
                      </PromptInputTabsList>
                      {models.map((m) => (
                        <PromptInputSelectItem key={m.id} value={m.id}>
                          {m.name}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                </PromptInputHoverCardTrigger>
                <PromptInputHoverCardContent className="w-64">
                  <PromptInputTabLabel>Model Info</PromptInputTabLabel>
                  <PromptInputTabBody>
                    <PromptInputTabItem>
                      <span className="font-medium">
                        {models.find(m => m.id === model)?.name}
                      </span>
                    </PromptInputTabItem>
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      Selected model for generating responses. Different models have different capabilities and performance characteristics.
                    </p>
                  </PromptInputTabBody>
                </PromptInputHoverCardContent>
              </PromptInputHoverCard>
            </PromptInputTools>

            <div className="flex items-center gap-2">
              <div className="h-4 w-[1px] bg-border/60 mx-1" />

              {/* Voice Input Button with Tooltip */}
              <PromptInputButton
                tooltip={{ content: "Voice input", shortcut: "⌘M" }}
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 text-muted-foreground/40 hover:text-foreground hover:bg-white/5 rounded-xl transition-all"
              >
                <AudioLines className="h-4 w-4" />
              </PromptInputButton>

              {/* Submit Button */}
              <PromptInputSubmit
                disabled={!text && !useWebSearch}
                className="h-9 w-9 rounded-xl"
              />
            </div>
          </PromptInputFooter>
        </PromptInput>
        
        {/* Helper text */}
        <p className="text-center text-xs text-muted-foreground/60 mt-3">
          Type "/" for quick suggestions • Drag & drop files anywhere
        </p>
      </div>
    </section>
  );
}
