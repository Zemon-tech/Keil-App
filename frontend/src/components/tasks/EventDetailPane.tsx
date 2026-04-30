import { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

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

import { EventDetailHeader } from "./EventDetailHeader";
import { EventOverviewTab } from "./EventOverviewTab";
import { ActivityTab } from "./ActivityTab";
import { HistoryTab } from "./HistoryTab";

type Props = {
  event: TaskDTO | null;
  onUpdateEvent?: (id: string, updates: any) => void;
  onEventDeleted?: (id: string) => void;
  onClose?: () => void;
};

const TAB_HEADERS = {
  overview: {
    title: "Overview",
    description: "View your event details, location, and relevant context links.",
  },
  activity: {
    title: "Activity",
    description: "Connect with your team and track the conversation around this event.",
  },
  history: {
    title: "History",
    description: "A complete audit log of changes made to this event.",
  },
} as const;

export function EventDetailPane({
  event,
  onEventDeleted,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    setActiveTab("overview");
  }, [event?.id]);

  const { data: freshEvent } = useTask(event?.id ?? "");

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const displayEvent = freshEvent ?? event;

  const [mockContext, setMockContext] = useState<ContextItem[]>([]);

  useEffect(() => {
    if (displayEvent) {
      setMockContext(displayEvent.context ?? []);
    }
  }, [displayEvent?.id]);

  const eventToRender = { ...displayEvent, context: mockContext } as TaskDTO;

  const handleUpdateEventWithMock = (_id: string, updates: any) => {
    if (updates.context) {
      setMockContext(updates.context);
    }

    const { context: _c, ...serverUpdates } = updates;
    if (Object.keys(serverUpdates).length > 0) {
      handleUpdateField(serverUpdates as UpdateTaskInput);
    }
  };

  const handleUpdateField = (updates: UpdateTaskInput) => {
    if (!displayEvent) return;
    updateTask.mutate({ id: displayEvent.id, updates });
  };

  const handleDelete = () => {
    if (!displayEvent) return;
    deleteTask.mutate(displayEvent.id, {
      onSuccess: () => onEventDeleted?.(displayEvent.id),
    });
  };

  if (!displayEvent) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <Empty className="w-full max-w-sm border-none shadow-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarIcon />
            </EmptyMedia>
            <EmptyTitle>No event selected</EmptyTitle>
            <EmptyDescription>
              Select an event from the list, or press{" "}
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
      <EventDetailHeader
        event={eventToRender}
        onUpdateField={handleUpdateField}
        onDelete={handleDelete}
        onClose={onClose}
        onEditTask={() => setEditDialogOpen(true)}
      />

      <CreateTaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        taskId={eventToRender.id}
        initialValues={eventToRender}
        onTaskCreated={() => {}}
        onTaskUpdated={() => setEditDialogOpen(false)}
      />

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
          <TabsList className="grid w-full xl:w-[350px] grid-cols-3">
            {(
              [
                { value: "overview", label: "Overview" },
                { value: "activity", label: "Activity" },
                { value: "history", label: "History" },
              ] as const
            ).map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-sm font-medium"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="m-0 min-h-0 flex-1 flex flex-col focus-visible:outline-none h-full">
          <EventOverviewTab
            event={eventToRender}
            onUpdateEvent={handleUpdateEventWithMock}
            onUpdateField={handleUpdateField}
          />
        </TabsContent>

        <TabsContent value="activity" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <ActivityTab task={eventToRender} />
        </TabsContent>

        <TabsContent value="history" className="m-0 flex-1 min-h-0 flex flex-col focus-visible:outline-none h-full overflow-hidden">
          <HistoryTab task={eventToRender} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
