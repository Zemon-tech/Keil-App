import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { MotionPageRecord } from "@/store/useMotionStore";

interface MotionSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: MotionPageRecord[];
}

const extractTextFromContent = (content: any): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (content.text) return content.text;
  if (Array.isArray(content)) return content.map(extractTextFromContent).join(" ");
  if (content.content) return extractTextFromContent(content.content);
  return "";
};

const getPreviewSnippet = (contentStr: string, query: string): string => {
  if (!contentStr) return "Empty page";
  if (!query.trim()) return contentStr.substring(0, 150);

  const idx = contentStr.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return contentStr.substring(0, 150);
  }

  const start = Math.max(0, idx - 60);
  const end = Math.min(contentStr.length, idx + query.length + 90);

  let snippet = contentStr.substring(start, end);
  
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < contentStr.length) {
    snippet = snippet + "...";
  }

  return snippet;
};

const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export function MotionSearchDialog({ open, onOpenChange, pages }: MotionSearchDialogProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    try {
      const escaped = escapeRegExp(highlight.trim());
      const regex = new RegExp(`(${escaped})`, "gi");
      const parts = text.split(regex);
      return (
        <span>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    } catch (e) {
      return <span>{text}</span>;
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "p") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages.slice(0, 10); // Show max 10 initially

    const query = searchQuery.toLowerCase();
    
    return pages.filter((page) => {
      const titleMatch = page.title.toLowerCase().includes(query);
      if (titleMatch) return true;

      const textContent = extractTextFromContent(page.content).toLowerCase();
      return textContent.includes(query);
    });
  }, [pages, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search pages</DialogTitle>
          <DialogDescription>Search pages by title or content</DialogDescription>
        </DialogHeader>
        <Command 
          shouldFilter={false} 
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput 
            placeholder="Search pages by title or content..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Pages">
              {filteredPages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={page.id}
                  onSelect={(value) => {
                    onOpenChange(false);
                    setSearchQuery("");
                    navigate(`/motion/${value}`);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col max-w-[90%] overflow-hidden">
                    <span className="truncate font-medium">
                      <HighlightText text={page.title} highlight={searchQuery} />
                    </span>
                    {searchQuery.trim() && (
                      <span className="truncate text-xs text-muted-foreground">
                        <HighlightText 
                          text={getPreviewSnippet(extractTextFromContent(page.content), searchQuery)} 
                          highlight={searchQuery} 
                        />
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

