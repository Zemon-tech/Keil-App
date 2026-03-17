# Drag-and-Drop Task Scheduling Implementation

## Overview
Implemented drag-and-drop functionality to schedule tasks from the work queue onto the calendar with validation, conflict detection, and visual feedback.

## Features Implemented

### 1. Draggable Task Cards
- **Location**: `TaskListPane.tsx`
- Tasks with status !== "Done" are draggable
- Visual indicators:
  - Grip icon appears on hover
  - Cursor changes to `grab` / `grabbing`
  - Card scales down slightly when dragging starts
- Uses FullCalendar's `Draggable` utility for external drag support

### 2. Droppable Calendar
- **Location**: `TaskSchedulePane.tsx`
- Calendar accepts external task drops
- Default duration: 1 hour
- Tasks can be resized after dropping
- Scheduled tasks appear as purple events on the calendar

### 3. Validation Rules

#### ✅ Prevents Scheduling "Done" Tasks
```
❌ Cannot schedule completed tasks
Toast: "Cannot schedule completed tasks - This task is already marked as done."
```

#### ✅ Prevents Past Scheduling
```
❌ Cannot schedule tasks in the past
Toast: "Cannot schedule in the past - Please select a future time slot."
```

#### ✅ Conflict Detection
```
⚠️ Scheduling conflict detected
Toast: "Scheduling conflict detected - This time overlaps with: [Task Names]"
Note: Allows scheduling but warns the user
```

### 4. Task Updates
- Updates `plannedStartISO` and `plannedEndISO` directly
- State managed in `SchedulePage.tsx`
- Changes are immediately reflected in the calendar
- Backend integration not implemented (dummy data only)

### 5. Visual Feedback & Logging

#### Console Logs
```javascript
// When dragging starts
🎯 Dragging task: { taskId, taskTitle, taskStatus }

// When dropped on calendar
🎯 Task dropped on calendar: { taskId, taskStatus, start, end }

// Validation failures
❌ Cannot schedule completed tasks
❌ Cannot schedule tasks in the past

// Conflict warnings
⚠️ Scheduling conflict detected: [conflicting task titles]

// Success
✅ Scheduling task: { taskId, startISO, endISO, duration }
📅 Scheduling task: { taskId, startISO, endISO }

// Resize events
📏 Started resizing event
📏 Task duration resized: { taskId, newDuration }

// Move events
🔄 Task moved: { taskId, newStart, newEnd }
```

#### Toast Notifications
- Success: "Task scheduled - [Task Name] scheduled for [Date/Time]"
- Success: "Task duration updated"
- Success: "Task rescheduled"
- Error: "Cannot schedule completed tasks"
- Error: "Cannot schedule in the past"
- Warning: "Scheduling conflict detected - Overlaps with: [Task Names]"

### 6. Resizing & Moving
- Scheduled tasks can be resized (change duration)
- Scheduled tasks can be moved (drag to different time)
- Both operations trigger conflict detection
- Both operations respect the "no past dates" rule

## Technical Details

### Dependencies Used
- `@fullcalendar/interaction` - Draggable utility and drop handling
- `date-fns` - Date manipulation and validation
- `sonner` - Toast notifications

### Key Components Modified

1. **TaskListPane.tsx**
   - Added `Draggable` initialization
   - Added drag attributes to task cards
   - Added grip icon for draggable tasks

2. **TaskSchedulePane.tsx**
   - Added `droppable` prop to FullCalendar
   - Implemented `eventReceive` handler (external drops)
   - Implemented `eventResize` handler (duration changes)
   - Implemented `eventDrop` handler (moving scheduled tasks)
   - Added conflict detection logic
   - Added validation logic
   - Scheduled tasks now render as calendar events

3. **SchedulePage.tsx**
   - Added task state management
   - Added `handleTaskSchedule` callback
   - Added `Toaster` component for notifications

4. **calendar-styles.css**
   - Added drag-and-drop visual feedback styles
   - Added scheduled task event styles

## Data Flow

```
User drags task card
    ↓
FullCalendar Draggable captures drag
    ↓
User drops on calendar time slot
    ↓
eventReceive handler triggered
    ↓
Validation checks:
  - Is task "Done"? → Reject
  - Is time in past? → Reject
  - Conflicts exist? → Warn but allow
    ↓
onTaskSchedule callback
    ↓
SchedulePage updates task state
    ↓
Task re-renders with plannedStartISO/plannedEndISO
    ↓
Calendar shows scheduled task as event
```

## Testing Checklist

- [x] Drag non-done task to calendar → Success
- [x] Drag done task to calendar → Error toast
- [x] Drag task to past time → Error toast
- [x] Drag task to conflicting time → Warning toast (allows)
- [x] Resize scheduled task → Updates duration
- [x] Move scheduled task → Updates time
- [x] Console logs show all operations
- [x] Toast notifications appear correctly
- [x] Visual feedback during drag
- [x] Scheduled tasks appear on calendar

## Future Enhancements (Not Implemented)

1. Backend API integration
2. Multi-day task scheduling
3. Recurring task scheduling
4. Batch scheduling
5. Undo/redo functionality
6. Drag from calendar back to task list (unscheduling)
7. Keyboard shortcuts for scheduling
8. Smart scheduling suggestions
9. Calendar sync (Google Calendar, Outlook, etc.)
10. Team member availability checking

## Notes

- All functionality is currently using mock data
- No backend API calls are made
- Task state is managed locally in SchedulePage component
- Conflicts are detected but don't prevent scheduling (warning only)
- Duration defaults to 1 hour but can be resized
