import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";import {
  CommandDialog,
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

export function MotionSearchDialog({ open, onOpenChange, pages }: MotionSearchDialogProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, "gi");
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
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search pages" description="Search pages by title or content">
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
                      text={extractTextFromContent(page.content).substring(0, 150) || "Empty page"} 
                      highlight={searchQuery} 
                    />
                  </span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
