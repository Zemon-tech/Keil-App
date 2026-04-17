import { useState, useMemo } from "react";
import { Flag, Loader2, Search, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { TaskPriority, TaskStatus, Dependency } from "@/types/task";
import type { TaskDTO } from "@/hooks/api/useTasks";
import { useTasks, useAddDependency, useRemoveDependency } from "@/hooks/api/useTasks";

import { STATUS_COLOR, PRIORITY_CONFIG } from "./task-detail-shared";

// ─── DependencyRow ────────────────────────────────────────────────────────────

function DependencyRow({ dep, onRemove }: { dep: Dependency; onRemove?: () => void }) {
  const priorityCfg = PRIORITY_CONFIG[dep.priority as TaskPriority] ?? PRIORITY_CONFIG.low;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border px-3 py-2",
        dep.status !== "done"
          ? "border-border bg-muted/20"
          : "border-border bg-muted/20"
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLOR[dep.status as TaskStatus] ?? "bg-zinc-500")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{dep.title}</p>
          <Badge variant="outline" className={cn("h-4 shrink-0 px-1 gap-1 text-[9px]", priorityCfg.color)}>
            <Flag className="h-2 w-2" />
            {dep.priority}
          </Badge>
        </div>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">{dep.id}</p>
      </div>
      <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
        {dep.status}
      </Badge>
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all rounded-md shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── DependenciesTab ──────────────────────────────────────────────────────────

export function DependenciesTab({ task }: { task: TaskDTO }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const addDependency = useAddDependency();
  const removeDependency = useRemoveDependency();
  const { data: allTasks, isPending: isLoadingTasks } = useTasks();

  // Get existing dependency IDs
  const existingDepIds = useMemo(() => {
    return new Set((task.dependencies ?? []).map((d) => d.id));
  }, [task.dependencies]);

  // Filter available tasks (exclude current task and existing dependencies)
  const availableTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(
      (t) => t.id !== task.id && !existingDepIds.has(t.id)
    );
  }, [allTasks, task.id, existingDepIds]);

  // Filter by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return availableTasks;
    const query = searchQuery.toLowerCase();
    return availableTasks.filter((t) => t.title.toLowerCase().includes(query));
  }, [availableTasks, searchQuery]);

  const handleToggleTask = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (selectedTasks.size === 0) return;
    // Add all selected tasks as dependencies
    const promises = Array.from(selectedTasks).map((taskId) =>
      addDependency.mutateAsync({ id: task.id, dependsOnTaskId: taskId })
    );
    Promise.all(promises).then(() => {
      setSelectedTasks(new Set());
      setIsPickerOpen(false);
      setSearchQuery("");
    });
  };

  const handleRemoveDependency = (blockedByTaskId: string) => {
    removeDependency.mutate({ id: task.id, blockedByTaskId });
  };

  const blockedByCount = (task.dependencies ?? []).length;
  const blockedByTasks = task.dependencies ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-2xl space-y-5 p-5">

        {/* Impact Summary Banner */}
        {(task.dependencies ?? []).length > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            <div>
              <p className="mb-0.5 text-xs font-semibold">Impact Summary</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This task is waiting on{" "}
                <span className="font-medium text-foreground">{blockedByCount}</span> upstream{" "}
                task{blockedByCount !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>
        )}

        {/* Blocked By */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Blocked By
            </span>
          </div>

          {/* Searchable Task Picker */}
          <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <PopoverTrigger asChild>
              <button className="mb-3 w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors text-left">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground flex-1">
                  Search tasks to add dependency...
                </span>
                {selectedTasks.size > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {selectedTasks.size} selected
                  </Badge>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
              {/* Search Input */}
              <div className="flex items-center gap-2 border-b border-border pb-2 mb-2 px-1">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Search tasks by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm border-none shadow-none focus-visible:ring-0 p-0 flex-1"
                />
              </div>

              {/* Task List */}
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {isLoadingTasks ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? "No tasks found" : "No available tasks"}
                  </p>
                ) : (
                  filteredTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleToggleTask(t.id)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left"
                    >
                      <Checkbox
                        checked={selectedTasks.has(t.id)}
                        onCheckedChange={() => handleToggleTask(t.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
                      </div>
                      <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_COLOR[t.status])} />
                    </button>
                  ))
                )}
              </div>

              {/* Add Button */}
              {selectedTasks.size > 0 && (
                <div className="border-t border-border pt-2 mt-2">
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleAddSelected}
                    disabled={addDependency.isPending}
                  >
                    {addDependency.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    ) : null}
                    Add {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Selected Tasks List */}
          <div className="space-y-1.5">
            {blockedByTasks.length > 0 ? (
              blockedByTasks.map((dep) => (
                <DependencyRow
                  key={dep.id}
                  dep={dep}
                  onRemove={() => handleRemoveDependency(dep.id)}
                />
              ))
            ) : (
              <p className="px-2 text-xs italic text-muted-foreground">
                Not blocked by anything
              </p>
            )}
          </div>
        </div>

      </div>
    </ScrollArea>
  );
}
