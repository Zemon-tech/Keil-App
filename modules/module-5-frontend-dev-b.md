# 🚀 Module 5: Dashboard Frontend (Dev-B) Breakdown

This guide explains **exactly** what the Frontend Developer (Dev-B) built for the Dashboard module in super simple terms!

---

## 🏗️ Phase 1: Foundation (Data & Hooks)

**Goal:** Create a clean way to ask the backend for our Dashboard data.

**What was built:** We created a specific "data box" (`DashboardTaskDTO`) so the dashboard only gets the exact little pieces of info it needs (like a task title and when it's due). Then we built a tool (`useDashboard`) that magically requests this info whenever the user opens the app.

**Code Snippet:**
```typescript
// 1. We tell the app exactly what a Dashboard Task looks like:
export type DashboardTaskDTO = {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    objective: string | null;
};

// 2. We use React Query to fetch the data safely:
export function useDashboard() {
    const { workspaceId } = useWorkspace();
    
    // This goes to the backend and grabs the dashboard info!
    return useQuery({
        queryKey: ["dashboard", workspaceId],
        queryFn: async () => {
            const res = await api.get("/v1/dashboard");
            return res.data;
        },
        enabled: !!workspaceId, // Only fetch if we have a workspace
    });
}
```
**🧠 Super Simple Explanation:** We taught the app what a Dashboard Task is. Then, we wrote a quick function that knocks on the backend's door and says, *"Hey! Give me the dashboard data for this workspace!"* 

---

## ⏸️ Phase 2: Park Inactive Components

**Goal:** Ignore complex dashboard features that we don't need *yet*.

**What was built:** There are a couple of advanced cards (`NeedsReply` and `NextEvent`) that aren't ready for this basic version. Instead of breaking the page, we securely parked them.

**Code Snippet:**
```tsx
// frontend/src/components/dashboard/NeedsReplyCard.tsx

// TODO: Wire in future module
import { Card } from "@/components/ui/card";

export function NeedsReplyCard() {
  return (
    <Card>
       {/* Fake static text goes here so it looks pretty but does nothing yet */}
       <h3>Needs Your Reply</h3>
    </Card>
  );
}
```
**🧠 Super Simple Explanation:** We literally just added a `// TODO` sticky note at the top of the file. It's like leaving a "Work in Progress" sign so we don't accidentally try to feed real data into a card that isn't ready to handle it.

---

## 🎨 Phase 3: Upgrade Active Cards

**Goal:** Make the visible dashboard cards look real instead of using fake text.

**What was built:** We told the `CurrentFocusCard`, `ImmediateBlockersCard`, and `UpNextCard` to stop using written text and start accepting *real* data props from the outside world.

**Code Snippet:**
```tsx
// frontend/src/components/dashboard/CurrentFocusCard.tsx

// We tell the component it MUST receive a 'task' and an 'isLoading' status
interface CurrentFocusCardProps {
  task: DashboardTaskDTO | null;
  isLoading: boolean;
}

export function CurrentFocusCard({ task, isLoading }: CurrentFocusCardProps) {
  // If the data is still loading, show a neat grey ghost outline!
  if (isLoading) return <Skeleton />;
  
  // If no task exists at all, show a nice empty message!
  if (!task) return <p>No urgent tasks right now</p>;

  return (
    <Card>
      {/* Show the REAL task title instead of fake typed text */}
      <p>{task.title}</p>
      
      {/* Show the REAL priority! */}
      <Badge>{task.priority}</Badge>
    </Card>
  );
}
```
**🧠 Super Simple Explanation:** We turned the visual cards into smart cards. Before, they were like a picture frame with a fake photo inside. Now, they are empty digital frames waiting (Loading State) to receive a real photo (`task`) to display!

---

## 🔌 Phase 4: Dashboard Container Wiring (Integration)

**Goal:** Connect the Brain (`Phase 1`) to the visual Cards (`Phase 3`).

**What was built:** We went into the main `Dashboard.tsx` screen and used our new `useDashboard()` tool to pull the data. Then, we accurately handed out the different pieces of data to the right visuals.

**Code Snippet:**
```tsx
// frontend/src/components/Dashboard.tsx
import { useDashboard } from "@/hooks/api/useDashboard";

export function Dashboard() {
  // 1. Use our tool to get data, loading status, and error status!
  const { data, isLoading, isError } = useDashboard();

  return (
    <main>
      {/* 2. Oops! If an error happens, cleanly show an alert instead of a blank white screen */}
      {isError && (
        <div className="error-alert">Failed to load dashboard data.</div>
      )}

      {/* 3. Pass the specific data pieces to the correct child cards! */}
      <section className="grid">
        {/* Pass ONLY the very first urgent task to the Focus Card */}
        <CurrentFocusCard task={data?.immediate?.[0]} isLoading={isLoading} />
        
        {/* Pass all immediate blockers to the Blockers Card */}
        <ImmediateBlockersCard tasks={data?.immediate} isLoading={isLoading} />
        
        {/* Pass today's tasks to the Up Next Card */}
        <UpNextCard tasks={data?.today} isLoading={isLoading} />
      </section>
    </main>
  );
}
```
**🧠 Super Simple Explanation:** Think of `Dashboard.tsx` as the boss. It grabs the giant box of data from the backend, opens the box, and says: *"Okay, Focus Card, here is your 1 task. Blocker Card, here is your list of tasks. Up Next Card, here is your list."* It also has a safety net: if the box gets dropped on the way (an Error), it politely tells the user instead of breaking the app!
