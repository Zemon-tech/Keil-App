# Dev-B — What Was Done (Schedule Module)

> **One line summary:** The Schedule page had a working UI with fake data. Dev-B replaced the fake data with real API calls. That's it.

---

## 🗂 8 Files Changed. Here's Each One.

---

### FILE 1 — `src/types/task.ts`
**Job: Add 3 new types so TypeScript knows what the API returns.**

```
ScheduleBlockDTO   → shape of a calendar event from the API
GanttTaskDTO       → shape of a Gantt bar from the API
UnscheduledTaskDTO → shape of a task not yet on the calendar
```
✅ Only added. Nothing deleted. Nothing else changed.

---

### FILE 2 — `src/hooks/api/useSchedule.ts` *(brand new file)*
**Job: Write 6 functions that call the backend API.**

Each hook = one API call. Just call the hook, get the data back.

```
useCalendarTasks        → GET  /schedule/calendar     → loads calendar events
useUnscheduledTasks     → GET  /schedule/unscheduled  → loads tasks not on calendar
useUpdateTaskTimeblock  → PUT  /schedule/tasks/:id/timeblock → places task on calendar
useDeleteTaskTimeblock  → DEL  /schedule/tasks/:id/timeblock → removes from calendar
useGanttTasks           → GET  /schedule/gantt        → loads Gantt chart tasks
useUpdateTaskDeadline   → PATCH /schedule/tasks/:id/deadline → changes task due date
```

**Built-in smart behaviors:**
- Save fails? → shows the server's error message as a toast notification
- Deadline change shifts other tasks? → shows "3 tasks were automatically shifted"
- Save succeeds? → calendar/gantt auto-refreshes (no page reload needed)

---

### FILE 3 — `src/components/schedule/ScheduleTaskModal.tsx` *(brand new file)*
**Job: The popup that appears when you click an empty spot on the calendar.**

How it flows:

```
Click empty calendar slot
    → Modal opens (pre-filled with that slot's time)
    → Type to search unscheduled tasks (waits 300ms before firing API call)
    → Select a task
    → Validations run automatically:
          No due date on task?  → Red error. Submit disabled.
          Times out of bounds?  → Yellow warning. Submit disabled.
          Task has a parent?    → Shows parent's due date as info.
    → Hit Submit → saved to API → modal closes → calendar refreshes
```

---

### FILE 4 — `src/components/SchedulePage.tsx`
**Job: Remove fake data. Use real API data instead.**

| Was using | Now using |
|---|---|
| `mockTasks` (hardcoded list) | `useTasks()` hook |
| `mockCalendarBlocks` (hardcoded list) | `useCalendarTasks()` hook |
| Nothing for Gantt | `useGanttTasks()` hook |
| No slot-click modal | `ScheduleTaskModal` opens on slot click |
| Gantt always editable | Gantt locked for non-admins (`isReadOnly`) |

---

### FILE 5 — `src/components/tasks/TaskSchedulePane.tsx`
**Job: Two small additions to the existing calendar component.**

```
1. User clicks empty calendar space
   → fires onSlotSelect(start, end)
   → SchedulePage opens the modal

2. API call fails after user drags/drops/resizes an event
   → event snaps back to original position (info.revert())
   → shows error toast with server message
```

---

### FILE 6 — `src/components/tasks/TaskTimelinePane.tsx`
**Job: Two small additions to the existing Gantt component.**

```
1. Admin drags a Gantt bar to new dates
   → fires onDeadlineChange(taskId, newStart, newEnd)
   → SchedulePage calls the deadline update API

2. isReadOnly prop added
   → true  = bars cannot be dragged (regular users)
   → false = bars can be dragged (admin / owner only)
```

---

### FILE 7 — `src/components/dashboard/NextEventCard.tsx`
**Job: Replace the static "TODO" placeholder with real data.**

```
isLoading = true  →  shows grey skeleton animation
block = null      →  shows "No events today"
block = event     →  shows task name + "starts in X hours"
```

---

### FILE 8 — `src/components/Dashboard.tsx`
**Job: Feed today's calendar data into the NextEventCard.**

```
1. Call useCalendarTasks(start of today → end of today)
2. Take the first event from the result
3. Pass it to <NextEventCard block={firstEvent} />
```

Everything else on the dashboard is untouched.

---

## ✅ Checklist

| # | File | Status |
|---|---|---|
| 1 | `types/task.ts` — 3 types added | ✅ Done |
| 2 | `hooks/api/useSchedule.ts` — 6 API hooks | ✅ Done |
| 3 | `components/schedule/ScheduleTaskModal.tsx` — new modal | ✅ Done |
| 4 | `components/SchedulePage.tsx` — real data wired | ✅ Done |
| 5 | `components/tasks/TaskSchedulePane.tsx` — slot select + error revert | ✅ Done |
| 6 | `components/tasks/TaskTimelinePane.tsx` — deadline + read-only | ✅ Done |
| 7 | `components/dashboard/NextEventCard.tsx` — real data | ✅ Done |
| 8 | `components/Dashboard.tsx` — wired to NextEventCard | ✅ Done |

---

## 🚫 What Dev-B Did NOT Touch

- Calendar UI layout and design → untouched
- Gantt chart UI layout and design → untouched  
- All other dashboard cards → untouched
- Backend code → untouched
- No new npm packages installed
