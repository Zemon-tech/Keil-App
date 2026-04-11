# Merge Conflict Resolution Rules

## Purpose
Guidelines for resolving Git merge conflicts while maintaining code structure integrity and combining features correctly.

## Core Principles

### 1. Understand Before Acting
- **ALWAYS read the entire file** before attempting to resolve conflicts
- Understand what each branch is trying to achieve (features, not just lines)
- Identify the scope of changes (UI redesign, new feature, refactor, etc.)
- Ask clarifying questions if the user's intent isn't clear

### 2. Preserve Code Structure
For React/TypeScript components, maintain this order:
1. Imports
2. Type definitions
3. Constants
4. Component function declaration
5. State declarations (useState, useRef)
6. Effects (useEffect, useMemo, useCallback)
7. Helper functions
8. Return statement with JSX

**NEVER place function definitions inside JSX return statements**

### 3. Validate Immediately
- Run `getDiagnostics` after resolving each major conflict section
- Fix structural issues before moving to the next conflict
- Don't accumulate errors - address them as they appear

### 4. Feature Integration
When combining features from both branches:
- Consider how features interact (can they coexist? do they conflict?)
- Use conditional rendering for mutually exclusive features
- Combine complementary features on the same elements when possible
- Example: Drag-and-drop + multi-select can both exist on task cards

## Conflict Resolution Process

### Step 1: Analysis
```typescript
// Read conflict markers and understand both versions
<<<<<<< HEAD
// Version A: What feature/change does this represent?
=======
// Version B: What feature/change does this represent?
>>>>>>> branch-name
```

### Step 2: Ask Clarifying Questions
Present the user with:
- What each branch is trying to do
- Key differences in approach
- Which features/styles they want to keep
- Whether they want features combined or one replaced

### Step 3: Plan the Integration
Before making changes:
- Decide which state variables are needed from each branch
- Identify which helper functions to keep/merge
- Plan how JSX will combine both approaches
- Consider edge cases (e.g., "Done" tasks shouldn't be draggable)

### Step 4: Implement Carefully

**Choose the right tool for the job:**

**Use `fsWrite` (rewrite entire file) when:**
- File has 3+ conflict sections
- Any conflict section is large (>20 lines)
- `strReplace` fails on first attempt
- You have complete understanding of all conflicts and user preferences

**Use `strReplace` (targeted replacement) when:**
- Single, small conflict section
- Confident about exact string matching
- Conflict is isolated and simple

**Implementation approach:**
- If using fsWrite: Write the complete file with all conflicts resolved at once
- If using strReplace: Resolve conflicts section by section
- Maintain proper code structure throughout
- Use meaningful variable names that reflect combined functionality
- Add comments for complex integration logic
- Don't fight with string matching - if strReplace fails, switch to fsWrite immediately

### Step 5: Validate and Fix
```bash
# After each major change
getDiagnostics(["path/to/file.tsx"])

# Fix any errors before proceeding
# Common issues:
# - Functions in wrong scope
# - Missing imports
# - Type mismatches
# - Undefined variables
```

## Common Pitfalls to Avoid

### ❌ Don't: Treat conflicts as pure text replacement
```typescript
// This creates malformed code:
return (
  <div>
    <div>Header</div>
  
function myHelper() {  // ❌ Function inside JSX!
  // ...
}
```

### ✅ Do: Maintain proper structure
```typescript
function MyComponent() {
  // Helper functions here
  function myHelper() {
    // ...
  }
  
  // Then return JSX
  return (
    <div>
      <div>Header</div>
    </div>
  );
}
```

### ❌ Don't: Blindly accept one side
```typescript
// User wants BOTH features, not just one
<<<<<<< HEAD
<DragHandle />
=======
<Checkbox />
>>>>>>> branch
```

### ✅ Do: Combine features thoughtfully
```typescript
// Both features can coexist
<>
  {isDraggable && <DragHandle />}
  <Checkbox />
</>
```

### ❌ Don't: Skip validation
```typescript
// Making multiple changes without checking
// Results in accumulating 37+ errors
```

### ✅ Do: Validate incrementally
```typescript
// After each conflict resolution:
// 1. Save file
// 2. Run getDiagnostics
// 3. Fix any errors
// 4. Move to next conflict
```

## React Component Specific Rules

### State Management
- Keep all `useState` declarations at the top of the component
- Merge state from both branches if both are needed
- Remove duplicate state declarations

### Effects
- Combine `useEffect` hooks with the same dependencies
- Keep effects after state declarations, before helper functions
- Preserve cleanup functions from both branches if needed

### Helper Functions
- Place ALL helper functions before the return statement
- Merge similar functions if they serve the same purpose
- Keep functions that serve different purposes from both branches

### JSX Structure
- Combine className strings using `cn()` utility
- Merge event handlers (e.g., both onClick handlers need to run)
- Use conditional rendering for mutually exclusive UI elements
- Combine complementary UI elements (drag handle + checkbox)

## Type Safety

### Always Check Types
```typescript
// After merging, verify:
// 1. All imported types are used
// 2. All used types are imported
// 3. Object properties match type definitions

// Example: Task type has 'history' not 'activity'
const task: Task = {
  // ...
  history: [],  // ✅ Correct
  // activity: [],  // ❌ Wrong - doesn't exist on Task type
};
```

### Import What You Need
```typescript
// Remove unused imports from rejected branch
// Add missing imports for accepted features
import { Badge } from "@/components/ui/badge";  // Only if used
```

## Examples

### Example 1: Combining UI Styles
```typescript
// HEAD: Card style with padding
className="p-3 space-y-4"

// origin/branch: Compact style
className="px-2 py-2 space-y-3 pb-20"

// User wants: Tighter spacing from branch
// Solution: Use branch's spacing
className="px-2 py-2 space-y-3 pb-20"
```

### Example 2: Combining Features
```typescript
// HEAD: Drag-and-drop functionality
<div 
  className="draggable-task-card"
  data-task-id={t.id}
>
  <GripVertical />
  {/* content */}
</div>

// origin/branch: Multi-select with checkbox
<div onClick={() => onSelect(t.id)}>
  <Checkbox checked={isChecked} />
  {/* content */}
</div>

// User wants: Both features
// Solution: Combine both
<div
  className={cn(
    "cursor-pointer",
    isDraggable && "draggable-task-card cursor-grab"
  )}
  onClick={() => !isMultiSelecting && onSelect(t.id)}
  data-task-id={t.id}
>
  {isDraggable && <GripVertical />}
  <Checkbox 
    checked={isChecked}
    onClick={(e) => toggleSelection(e, t.id)}
  />
  {/* content */}
</div>
```

## Checklist

Before marking a merge conflict as resolved:

- [ ] Read the entire file to understand structure
- [ ] Asked user clarifying questions about their intent
- [ ] Documented all user preferences before starting implementation
- [ ] Chose appropriate tool (fsWrite for complex merges, strReplace for simple ones)
- [ ] If strReplace failed, switched to fsWrite immediately
- [ ] Maintained proper component structure (state → effects → helpers → JSX)
- [ ] No function definitions inside JSX
- [ ] Ran getDiagnostics and fixed all errors
- [ ] Verified all imports are correct
- [ ] Checked that types match (e.g., Task properties)
- [ ] Tested that combined features make sense together
- [ ] Added comments for complex integration logic

## Backend Same-Feature Dual-Implementation Conflicts

When both branches independently implemented the same backend feature (controllers, services, routes, migrations), the conflict is **architectural**, not textual. Different rules apply:

### Step 1: Build a Dependency Map First
Before asking any questions, trace inter-file dependencies:
- Does `socket.ts` call `chatService.saveMessage()`? That method may only exist in one branch's service.
- Does the controller import `io` from `../index`? That's a circular dependency risk.
- Does the schema have a `role` column? Controller endpoints for member management only work if it exists.

**Read conflict-free files too.** Files that merged cleanly (no conflict markers) are easy to skip, but if other files import from them, verify their exports match what the importing files expect. Example: `socket.ts` had no conflict and was already staged, but `io` wasn't exported — caught only by running `getDiagnostics` after writing the controller.

### Step 2: Identify Fork Points (Not Line Differences)
The questions that matter for backend conflicts:
| Fork Point | Why It Matters |
|---|---|
| Where does socket/infra logic live? | Determines circular import risk |
| Which schema columns exist? | Other code may depend on columns only one branch added |
| Which service interface does infra use? | Socket layer may call methods that only exist in one version |
| UUID generation strategy | `uuid_generate_v4()` requires DB extension; `gen_random_uuid()` is built-in |

### Step 3: Resolve in Dependency Order
Schema/migration → service → controller → routes → index/entry point

Never resolve `index.ts` before knowing the socket architecture decision — the file looks completely different depending on the answer.

### Step 4: Extra Features Need Explicit Approval
If the incoming branch added endpoints or events not in the original spec (e.g., `typing_start`/`typing_end`, `addChannelMembers`), surface them explicitly. Don't silently include them.

## Related Documentation
- See `docs/tasks/lessons.md` for detailed examples of merge conflict mistakes and solutions
- React component structure best practices
- TypeScript type safety guidelines
