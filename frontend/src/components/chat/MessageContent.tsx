import { useState } from "react";
import { User } from "lucide-react";

interface MessageContentProps {
  content: string;
  isMine: boolean;
}

export function MessageContent({ content, isMine }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const CHAR_LIMIT = 280;

  if (!content) return null;

  const isLong = content.length > CHAR_LIMIT;
  const displayText = isLong && !isExpanded 
    ? content.slice(0, CHAR_LIMIT) + "..." 
    : content;

  const linkify = (text: string) => {
    // First, handle @mentions
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, i) => {
      if (part.match(mentionRegex)) {
        const name = part.slice(1); // Remove @
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-semibold bg-primary/8 text-primary border border-primary/20 dark:bg-primary/15 dark:border-primary/30 transition-colors`}
          >
            <User className="size-3 shrink-0 opacity-70" />
            {name}
          </span>
        );
      }
      // Then handle URLs
      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
      const urlParts = part.split(urlRegex);
      return urlParts.map((urlPart, j) => {
        if (urlPart.match(urlRegex)) {
          const href = urlPart.startsWith("http") ? urlPart : `https://${urlPart}`;
          return (
            <a
              key={`${i}-${j}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline hover:opacity-80 transition-opacity break-all cursor-pointer ${
                isMine 
                  ? "!text-primary-foreground hover:!text-primary-foreground/80" 
                  : "text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {urlPart}
            </a>
          );
        }
        return urlPart;
      });
    });
  };

  return (
    <div className="whitespace-pre-wrap break-all">
      <span>{linkify(displayText)}</span>
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={`ml-1.5 font-bold hover:underline cursor-pointer focus:outline-none text-[10px] uppercase tracking-wider ${
            isMine ? "text-primary-foreground/90" : "text-primary/80 dark:text-primary-foreground/80"
          }`}
        >
          {isExpanded ? "Show Less" : "Read More"}
        </button>
      )}
    </div>
  );
}
