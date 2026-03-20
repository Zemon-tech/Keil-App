# Phase 0 Frontend Work Guide — Feature/Foundation-FE

Is guide ka maqsad aapko batana hai ki **Phase 0** mein frontend par kya changes ki gayi hain aur kyun. Sabhi kaam complete ho chuki hai — yeh document reference ke liye hai.

---

## 🔢 Kaam ka Order (Stage by Stage)

> Har stage ek chhota, independent kaam tha. Ek stage complete karo, phir agli stage.

---

## 🏷️ Stage 1: Types Fix Karna

### File: `frontend/src/types/task.ts`
**Kaam:** Frontend ke type definitions ko backend ke database enums se match karna.

**Kya badla:**
```typescript
// BEFORE ❌
export type TaskStatus = "Backlog" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";

// AFTER ✅
export type TaskStatus = "backlog" | "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
```

**Kyun:** Backend PostgreSQL enums lowercase use karta hai. Agar match nahi hote toh API se data aane par TypeScript errors aate.

---

## 📦 Stage 2: Mock Data Fix Karna

### File: `frontend/src/data/mockTasks.ts`
**Kaam:** Purane status/priority strings ko naye lowercase values se replace karna.

**Replacements table:**

| Purana Value (Wrong ❌) | Naya Value (Correct ✅) |
|---|---|
| `"In Progress"` | `"in-progress"` |
| `"Backlog"` | `"backlog"` |
| `"Done"` | `"done"` |
| `"Blocked"` | `"in-progress"` *(temporary)* |
| `"High"` | `"high"` |
| `"Medium"` | `"medium"` |
| `"Low"` | `"low"` |
| `"Critical"` | `"urgent"` |

**Kyun:** Type fix ke baad mock data mein purane strings rakhe toh TypeScript compile error aata.

---

## 🎨 Stage 3: Components Fix Karna

### File: `frontend/src/components/tasks/TaskListPane.tsx`
**Kaam:** Status colors, filters, aur default values ko naye enums pe update karna.

**Kya badla:**
- `STATUS_OPTIONS` → ab `["backlog", "todo", "in-progress", "done"]`
- `statusColorMap` keys → lowercase (`"in-progress"`, `"backlog"`, `"done"`, `"todo"`)
- `FILTER_OPTIONS` → `"Blocked"` chip hata diya, `"in-progress"` label hai `"Active"`
- `isDone` check → `t.status === "done"` (lowercase)
- `isHighPriority` check → `"high"` aur `"urgent"` (lowercase)
- Default form values → `"backlog"` aur `"medium"`

---

### File: `frontend/src/components/tasks/TaskDetailPane.tsx`
**Kaam:** Status badge, priority config, aur "Mark done" button ko naye enums pe update karna.

**Kya badla:**
- `STATUS_OPTIONS` → `["backlog", "todo", "in-progress", "done"]`
- `STATUS_COLOR` keys → lowercase + `"todo"` add kiya (violet)
- `PRIORITY_CONFIG` → `"Critical"` → `"urgent"`, sab lowercase
- `handleMarkDone()` → `{ status: "done" }` (lowercase)
- "Mark done" button disabled check → `task.status === "done"`

---

## 📦 Stage 4: TanStack Query Install Karna

**Command jo run ki gayi:**
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**Kyun:** TanStack Query server state management ke liye use hota hai — API calls caching, refetching, aur loading states automatically handle hoti hain.

---

## 🪝 Stage 5: `useMe` Hook Banana

### File: `frontend/src/hooks/api/useMe.ts` *(naya file)*
**Kaam:** `GET /api/users/me` ko TanStack Query ke saath wrap karna.

**Hook kya return karta hai:**
```typescript
{
  id: string,
  email: string,
  name: string | null,
  created_at: string,
  workspace: {
    id: string,       // ← yeh sabse important hai
    name: string,
    role: "owner" | "admin" | "member"
  }
}
```

**Key details:**
- Query key: `["me"]`
- 401 par retry nahi hoga (user logged out hai)
- Response aa jaane ke baad `WorkspaceContext` is data ko use karta hai

---

## 📁 Stage 6: Placeholder Hook Files Banana

### Folder: `frontend/src/hooks/api/`
**Kaam:** Module 1 ke liye empty placeholder files banana jo baad mein fill hongi.

**Files banai gayi (abhi sirf placeholders hain):**

| File | Kab use hogi |
|---|---|
| `useTasks.ts` | Module 1 — task list API calls |
| `useComments.ts` | Module 1 — task comments |
| `useActivity.ts` | Module 1 — activity log |
| `useDashboard.ts` | Module 1 — dashboard data |

---

## 🏗️ Stage 7: WorkspaceContext Banana

### File: `frontend/src/contexts/WorkspaceContext.tsx` *(naya file)*
**Kaam:** Puri app ko `workspaceId` available karana — har task API call ke liye yeh zarori hai.

**Context kya expose karta hai:**
```typescript
{
  workspaceId: string | null,
  workspaceName: string | null,
  workspaceRole: "owner" | "admin" | "member" | null,
  isLoading: boolean
}
```

**Kaise use karo (kisi bhi component mein):**
```typescript
import { useWorkspace } from "@/contexts/WorkspaceContext";

const { workspaceId } = useWorkspace();
```

**Important:** `useWorkspace()` `AuthProvider` ke andar use karna, warna error aayega.

---

## 🔌 Stage 8: `main.tsx` Wire Karna

### File: `frontend/src/main.tsx`
**Kaam:** Naye providers ko correct order mein app tree mein add karna.

**Provider order (yeh order change mat karna):**
```tsx
<QueryClientProvider client={queryClient}>   ← sabse bahar
  <BrowserRouter>
    <AuthProvider>                           ← session manage karta hai
      <WorkspaceProvider>                    ← session ke baad fire hota hai
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </BrowserRouter>
  <ReactQueryDevtools initialIsOpen={false} /> ← dev tool, sirf dev mein dikhta hai
</QueryClientProvider>
```

**QueryClient settings:**
```typescript
staleTime: 5 * 60 * 1000   // 5 minute cache
retry: 1                    // sirf 1 baar retry
```

---

## ✅ Final Task Checklist

Yeh sab ek-ek karke complete ho gaya hai:

- [x] **Types Fixed:** `TaskStatus` aur `TaskPriority` ab backend enums se match karti hain
- [x] **Mock Data Fixed:** Koi bhi `"Blocked"` ya `"Critical"` string source mein nahi bachi
- [x] **TaskListPane Fixed:** `statusColorMap`, `FILTER_OPTIONS`, default values sab updated
- [x] **TaskDetailPane Fixed:** `STATUS_COLOR`, `PRIORITY_CONFIG`, "Mark done" sab updated
- [x] **TanStack Query Installed:** `@tanstack/react-query` + devtools — 0 vulnerabilities
- [x] **`useMe` Hook Created:** `GET /api/users/me` properly wrapped with error handling
- [x] **Placeholder Hooks Created:** `useTasks`, `useComments`, `useActivity`, `useDashboard`
- [x] **WorkspaceContext Created:** `useWorkspace()` hook available throughout the app
- [x] **`main.tsx` Updated:** Correct provider order — QueryClient → Auth → Workspace

---

## ⏳ Kya Baaki Hai (Dev A Par Depend Karta Hai)

Frontend ka kaam 100% complete hai. Ab Dev A ko backend mein `GET /api/users/me` upgrade karna hai taaki response mein `workspace` object aa sake.

Dev A ka kaam merge hone ke baad:
1. Sign in karo
2. `GET /api/users/me` check karo — workspace data aana chahiye
3. Browser mein **ReactQueryDevtools** (screen ke corner pe) open karo — `["me"]` query active dikhni chahiye
4. `useWorkspace()` ka `workspaceId` non-null hona chahiye

Tabhi **Module 1** shuru kar sakte hain. ✅

---

**Final Status:** Phase 0 Frontend 100% Complete.
