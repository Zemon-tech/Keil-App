import { useState } from "react";
import { Plus, MoreHorizontal, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMotionStore } from "@/store/useMotionStore";
import { useUpdateMotionPage } from "@/hooks/api/useMotionPages";
import { useAppContext } from "@/contexts/AppContext";

interface KanbanColumn {
  id: string;
  title: string;
  taskIds: string[];
}

interface KanbanTask {
  id: string;
  content: string;
}

interface KanbanData {
  tasks: Record<string, KanbanTask>;
  columns: Record<string, KanbanColumn>;
  columnOrder: string[];
}

const initialData: KanbanData = {
  tasks: {
    "task-1": { id: "task-1", content: "Implement Kanban UI" },
    "task-2": { id: "task-2", content: "Integrate with MotionStore" },
    "task-3": { id: "task-3", content: "Add drag and drop support" },
  },
  columns: {
    "col-1": {
      id: "col-1",
      title: "To Do",
      taskIds: ["task-1", "task-2"],
    },
    "col-2": {
      id: "col-2",
      title: "In Progress",
      taskIds: ["task-3"],
    },
    "col-3": {
      id: "col-3",
      title: "Done",
      taskIds: [],
    },
  },
  columnOrder: ["col-1", "col-2", "col-3"],
};

export function KanbanComponent({ pageId }: { pageId: string }) {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { updatePageLocally, getPageById } = useMotionStore();
  const updatePage = useUpdateMotionPage(activeOrgId, activeSpaceId);
  const page = getPageById(pageId);
  
  // Use page content as kanban data if it exists, otherwise use initialData
  const [data, setData] = useState<KanbanData>(() => {
    if (page?.content && (page.content as any).kanbanData) {
      return (page.content as any).kanbanData;
    }
    return initialData;
  });

  const saveData = (newData: KanbanData) => {
    setData(newData);
    // 1. Update optimistic store
    updatePageLocally(pageId, { content: { kanbanData: newData } as any });
    // 2. Persist to API
    updatePage.mutate({ id: pageId, updates: { content: { kanbanData: newData } as any } });
  };

  const addColumn = () => {
    const id = `col-${Date.now()}`;
    const newColumn: KanbanColumn = {
      id,
      title: "New Column",
      taskIds: [],
    };
    const newData = {
      ...data,
      columns: { ...data.columns, [id]: newColumn },
      columnOrder: [...data.columnOrder, id],
    };
    saveData(newData);
  };

  const addTask = (columnId: string) => {
    const id = `task-${Date.now()}`;
    const newTask: KanbanTask = { id, content: "New Task" };
    const column = data.columns[columnId];
    const newData = {
      ...data,
      tasks: { ...data.tasks, [id]: newTask },
      columns: {
        ...data.columns,
        [columnId]: {
          ...column,
          taskIds: [...column.taskIds, id],
        },
      },
    };
    saveData(newData);
  };

  return (
    <div className="flex size-full gap-6 p-6 overflow-x-auto min-w-0 custom-scrollbar-kanban">
      {data.columnOrder.map((columnId) => {
        const column = data.columns[columnId];
        const tasks = column.taskIds.map((taskId) => data.tasks[taskId]);

        return (
          <div
            key={column.id}
            className="flex flex-col w-80 shrink-0 bg-muted/30 rounded-2xl border border-border/50"
          >
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground/80">{column.title}</h3>
                <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground/60">
                  {tasks.length}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground/40 hover:text-foreground">
                <MoreHorizontal className="size-4" />
              </Button>
            </div>

            <div className="flex-1 flex flex-col gap-3 p-3 pt-2 overflow-y-auto custom-scrollbar-kanban">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="group bg-card border border-border/50 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-border transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground/90 leading-relaxed">
                      {task.content}
                    </p>
                    <GripVertical className="size-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
                  </div>
                </div>
              ))}
              
              <Button
                onClick={() => addTask(column.id)}
                variant="ghost"
                className="w-full justify-start gap-2 h-10 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 rounded-xl"
              >
                <Plus className="size-4" />
                <span className="text-sm font-medium">Add task</span>
              </Button>
            </div>
          </div>
        );
      })}

      <div className="w-80 shrink-0">
        <Button
          onClick={addColumn}
          variant="ghost"
          className="w-full h-14 justify-start gap-3 text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 hover:border-border transition-all"
        >
          <Plus className="size-5" />
          <span className="font-bold">Add column</span>
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar-kanban::-webkit-scrollbar {
          height: 6px;
          width: 4px;
        }
        .custom-scrollbar-kanban::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar-kanban:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
      `}} />
    </div>
  );
}
