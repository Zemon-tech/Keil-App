# Fix Schedule Calendar Resize Constraints

## Problem
- Calendar panel can be resized too small, causing UI elements to scramble
- Buttons (day/week/month/list, prev/next, today) overlap and become unreadable
- Need dynamic minimum width based on active calendar view

## Root Cause
- ResizablePanel has fixed `minSize={40}` (percentage-based)
- FullCalendar has no minimum width constraint
- No view-aware resize limits
- FullCalendar toolbar elements wrap/overlap at small widths

## Solution Approach
Track active calendar view and set dynamic minimum panel size to prevent content scrambling

---

## Phase 1: Add View State Tracking

### 1.1 Add calendar view state to TaskSchedulePane
- Add state: `currentView` (type: "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek")
- Default: "timeGridWeek"
- Track view changes via FullCalendar's `viewDidMount` callback

### 1.2 Pass view state up to SchedulePage
- Add prop to TaskSchedulePane: `onViewChange?: (view: string) => void`
- Emit view changes to parent
- Add state in SchedulePage: `calendarView`

---

## Phase 2: Calculate Dynamic Minimum Widths

### 2.1 Define minimum widths per view
Constants in SchedulePage:
- Week view: 750px (7 days + time column fully visible)
- Day view: 450px (single day + time column comfortable)
- Month view: 650px (all dates visible without wrap)
- List view: 400px (list items readable)

### 2.2 Convert pixel widths to percentage
- Get viewport width via `window.innerWidth`
- Calculate: `minPercent = (minPixels / viewportWidth) * 100`
- Account for left panel size (subtract from available width)

---

## Phase 3: Implement Dynamic Resize Constraints

### 3.1 Add resize constraint logic
- Create function: `calculateMinSize(view: string, viewportWidth: number): number`
- Returns percentage value for ResizablePanel minSize
- Clamp between 40% and 75% to prevent edge cases

### 3.2 Update ResizablePanel minSize dynamically
- Use calculated minSize instead of fixed 40
- Update on view change
- Update on window resize (debounced)

### 3.3 Add window resize listener
- Listen to window resize events
- Recalculate minSize on viewport width change
- Debounce to 150ms to avoid performance issues
- Cleanup listener on unmount

---

## Phase 4: Prevent FullCalendar Toolbar Scrambling

### 4.1 Add CSS constraints to calendar toolbar
In `calendar-styles.css`:
- Set `.fc-header-toolbar` min-width per view
- Prevent button wrapping: `flex-wrap: nowrap`
- Hide overflow gracefully if needed
- Ensure buttons maintain minimum touch target size (44px)

### 4.2 Responsive toolbar adjustments
- Use CSS to adjust button sizes at breakpoints
- Ensure "today" button doesn't wrap
- Keep view switcher buttons in single row

---

## Phase 5: Testing & Edge Cases

### 5.1 Test scenarios
- Switch between all 4 views and verify minimum widths
- Resize window and verify recalculation
- Test on different screen sizes (1920px, 1366px, 1024px)
- Verify left panel still resizable within constraints

### 5.2 Handle edge cases
- Very small screens (<1024px): Set absolute minimum
- Left panel at maximum: Ensure right panel still usable
- Rapid view switching: Debounce if needed

---

## Implementation Order

1. Phase 1.1 → Phase 1.2 (view tracking)
2. Phase 2.1 → Phase 2.2 (width calculations)
3. Phase 3.1 → Phase 3.2 → Phase 3.3 (dynamic constraints)
4. Phase 4.1 → Phase 4.2 (CSS fixes)
5. Phase 5 (testing)

---

## Files to Modify

1. `frontend/src/components/SchedulePage.tsx`
   - Add calendarView state
   - Add calculateMinSize function
   - Add window resize listener
   - Update ResizablePanel minSize prop

2. `frontend/src/components/tasks/TaskSchedulePane.tsx`
   - Add currentView state
   - Add onViewChange prop
   - Add viewDidMount callback to FullCalendar
   - Emit view changes to parent

3. `frontend/src/components/tasks/calendar-styles.css`
   - Add toolbar min-width constraints
   - Add flex-wrap: nowrap
   - Add responsive adjustments

---

## Success Criteria

- ✓ Calendar cannot be resized smaller than view-specific minimum
- ✓ All toolbar buttons remain visible and clickable
- ✓ Day names in week view don't wrap
- ✓ Dates in month view remain readable
- ✓ Minimum width updates when switching views
- ✓ Works on screens 1024px and larger
- ✓ No performance issues during resize
