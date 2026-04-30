import { useState, useEffect } from "react";
import { FileText } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

import type { ContextItem } from "@/types/task";
import type { TaskDTO, UpdateTaskInput } from "@/hooks/api/useTasks";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/api/useTasks";
import { useUpdatePersonalTask, useDeletePersonalTask } from "@/hooks/api/usePersonalTasks";

import { TaskDetailHeader } from "./TaskDetailHeader";
import { OverviewTab } from "./OverviewTab";
import { ActivityTab } from "./ActivityTab";
import { DependenciesTab } from "./DependenciesTab";
import { HistoryTab } from "./HistoryTab";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  task: TaskDTO | null;
  onUpdateTask?: (id: string, updates: any) => void;
  /** Called when the user deletes the displayed task */
  onTaskDeleted?: (id: string) => void;
  /** Called when the user wants to close the detail pane */
  onClose?: () => void;
  /** Notion-style subtask navigation: navigate into a subtask */
  onNavigateToSubtask?: (subtaskId: string) => void;
  /** Navigate back to parent task */
  onNavigateToParent?: (parentTaskId: string) => void;
  /** Parent task info for breadcrumb trail */
  parentTask?: { id: string; title: string } | null;
  /** When true, routes mutations to personal task endpoints and hides org-only tabs */
  isPersonalMode?: boolean;
};

// ─── Tab header metadata ──────────────────────────────────────────────────────

const TAB_HEADERS = {
  overview: {
    title: "Overview",
    description: "View your task details, nested subtasks, and relevant context links.",
  },
  activity: {
    title: "Activity",
    description: "Connect with your team and track the conversation around this task.",
  },
  dependencies: {
    title: "Dependencies",
    description: "Manage task blockers and upstream items required to complete this task.",
  },
  history: {
    title: "History",
    description: "A complete audit log of changes made to this task.",
  },
} as const;

// ─── TaskDetailPane ───────────────────────────────────────────────────────────

export function TaskDetailPane({
  task,
  onTaskDeleted,
  onClose,
  onNavigateToSubtask,
  onNavigateToParent,
  parentTask,
  isPersonalMode = false,
}: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Reset to Overview whenever the selected task changes
  useEffect(() => {
    setActiveTab("overview");
  }, [task?.id]);

  // Fetch fresh server data whenever a task is selected
  const { data: freshTask } = useTask(task?.id ?? "");

  // Mutations — personal mode routes to personal task endpoints
  const updateOrgTask = useUpdateTask();
  const deleteOrgTask = useDeleteTask();
  const updatePersonalTask = useUpdatePersonalTask();
  const deletePersonalTask = useDeletePersonalTask();

  // Use fresh data from server if available, fall back to prop (list data)
  const displayTask = freshTask ?? task;

  // Local state for Context (since it is a frontend-only mock for MVP v0.5)
  const [mockContext, setMockContext] = useState<ContextItem[]>([]);

  useEffect(() => {
    if (displayTask) {
      setMockContext(displayTask.context ?? []);
    }
  }, [displayTask?.id]);

  const taskToRender = { ...displayTask, context: mockContext } as TaskDTO;

  const handleUpdateTaskWithMock = (_id: string, updates: any) => {
    if (updates.context) {
      setMockContext(updates.context);
    }

    // Filter out mock-only fields before sending to server
    const { context: _c, ...serverUpdates } = updates;
    if (Object.keys(serverUpdates).length > 0) {
      handleUpdateField(serverUpdates as UpdateTaskInput);
    }
  };

  // Centralized field-update handler — routes to correct endpoint based on mode
  const handleUpdateField = (updates: UpdateTaskInput) => {
    if (!displayTask) return;
    if (isPersonalMode) {
      updatePersonalTask.mutate({ id: displayTask.id, updates });
    } else {
      updateOrgTask.mutate({ id: displayTask.id, updates });
    }
  };

  const handleDelete = () => {
    if (!displayTask) return;
    if (isPersonalMode) {
      deletePersonalTask.mutate(displayTask.id, {
        onSuccess: () => onTaskDeleted?.(displayTask.id),
      });
    } else {
      deleteOrgTask.mutate(displayTask.id, {
        onSuccess: () => onTaskDeleted?.(displayTask.id),
      });
    }
  };

  if (!displayTask) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <Empty className="w-full max-w-sm border-none shadow-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No task selected</EmptyTitle>
            <EmptyDescription>
              Select a task from the list, or press{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                C
              </kbd>{" "}
              to create a new one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden overscroll-none">

      {/* Zone 1: Compact header — never scrolls */}
      <TaskDetailHeader
        task={taskToRender}
        onUpdateField={handleUpdateField}
        onDelete={handleDelete}
        onClose={onClose}
        onEditTask={() => setEditDialogOpen(true)}
        parentTask={parentTask}
        onNavigateToParent={onNavigateToParent}
      />

      {/* Edit task dialog */}
      <CreateTaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        taskId={taskToRender.id}
        initialValues={taskToRender}
        isPersonalMode={isPersonalMode}
        onTaskCreated={() => {}}
        onTaskUpdated={() => setEditDialogOpen(false)}
      />

      {/* Zone 2 + 3: Tab bar + content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col w-full"
      >
        <div className="py-5 px-6 border-b border-border/40 shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg leading-none tracking-tight">
              {TAB_HEADERS[activeTab as keyof typeof TAB_HEADERS]?.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              {TAB_HEADERS[activeTab as keyof typeof TAB_HEADERS]?.description}
            </p>
          </div>
          {/* Personal mode: only show Overview tab (Activity/Deps/History need org context) */}
          <TabsList className={`grid w-full ${isPersonalMode ? "xl:w-[200px] grid-cols-1" : "xl:w-[450px] grid-cols-4"}`}>
            {(
              [
                { value: "overview", label: "Overview" },
                ...(!isPersonalMode ? [
                  { value: "activity", label: "Activity" },
                  {
                    value: "dependencies",
                    label: "Dependencies",
                    count: (taskToRender.dependencies ?? []).length,
                  },
                  { value: "history", label: "History" },
                ] : []),
              ] as const
            ).map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-sm font-medium"
              >
                {tab.label}
                {"count" in tab && tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1.5 rounded bg-muted-foreground/20 px-1 font-mono text-[10px]">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab content */}
        <TabsContent value="overview" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <OverviewTab
            task={taskToRender}
            onUpdateTask={handleUpdateTaskWithMock}
            onUpdateField={handleUpdateField}
            onNavigateToSubtask={onNavigateToSubtask}
          />
        </TabsContent>

        <TabsContent value="activity" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <ActivityTab task={taskToRender} />
        </TabsContent>

        <TabsContent value="dependencies" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <DependenciesTab task={taskToRender} />
        </TabsContent>

        <TabsContent value="history" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <HistoryTab task={taskToRender} />
        </TabsContent>
      </Tabs>

    </div>
  );
}
