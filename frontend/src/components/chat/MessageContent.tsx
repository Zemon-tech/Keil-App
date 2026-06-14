import { useState } from "react";

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
    // Regex matching URLs starting with http://, https://, or www.
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        const href = part.startsWith("http") ? part : `https://${part}`;
        return (
          <a
            key={i}
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
            {part}
          </a>
        );
      }
      return part;
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
