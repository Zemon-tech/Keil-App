import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── BulletListEditor ─────────────────────────────────────────────────────────

export function BulletListEditor({
  title,
  value,
  onSave,
  placeholder,
  disabled = false,
}: {
  title: string;
  value: string;
  onSave: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const points = value ? value.split("\n").filter(Boolean).map(p => p.replace(/^•\s*/, "")) : [];
  const [newPoint, setNewPoint] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (newPoint.trim()) {
      onSave([...points, newPoint.trim()].join("\n"));
      setNewPoint("");
      setIsAdding(false);
    }
  };

  const handleDelete = (index: number) => {
    const newPoints = points.filter((_, i) => i !== index);
    onSave(newPoints.join("\n"));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Title & Add Button header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        {!isAdding && !disabled && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-[10px] uppercase font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 max-h-[160px] pr-2">
        {points.length > 0 ? (
          <ul className="space-y-1.5 list-none">
            {points.map((pt, i) => (
              <li key={i} className="group flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                <span className="flex-1 leading-snug">{pt}</span>
                {!disabled && (
                  <button
                    onClick={() => handleDelete(i)}
                    className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-muted-foreground">{placeholder}</p>
        )}
      </ScrollArea>

      {isAdding && (
        <div className="pt-2 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newPoint}
              onChange={(e) => setNewPoint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewPoint("");
                }
              }}
              onBlur={() => {
                // If clicked outside and it's empty, close input. Otherwise keep it or save it.
                if (newPoint.trim()) handleAdd();
                else setIsAdding(false);
              }}
              placeholder="Type a point and press Enter..."
              className="h-8 text-xs"
            />
            <Button size="sm" variant="ghost" className="size-8 p-0 shrink-0" onClick={() => setIsAdding(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
