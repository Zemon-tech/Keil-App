# Motion Comments - Implementation Strategy

This document outlines the architectural and design plan for implementing the "Comments in Page" feature within the Motion workspace. The goal is to create a high-fidelity, performant, and scalable commenting system that aligns with the premium aesthetics of the platform.

## 1. Architectural Overview

### Lightweight Design
- **Single Component Architecture**: The comment system will be encapsulated within a single, highly-modular component `MotionPageComments.tsx`.
- **Zero Heavy Dependencies**: Instead of large third-party comment libraries, we will use native React state and custom hooks, leveraging existing utilities like `cn()` and `lucide-react`.
- **Headless Logic**: Logic for data persistence and threading will be separated from the UI to ensure the component remains easy to test and maintain.

### Scalability Strategy
- **Isolated Storage**: Data will be stored in `localStorage` using a key pattern: `motion_comments_${pageId}`. This ensures comments for one page never interfere with another.
- **Backend-Ready**: The implementation will use a clean interface (`interface Comment`) so that swapping `localStorage` for a Supabase/PostgreSQL backend in the future requires zero changes to the UI components.
- **Virtualization Support**: The component will be designed to handle hundreds of comments by using efficient list rendering and optional pagination/lazy loading if the thread grows excessively large.

## 2. Implementation Steps

### Phase 1: Foundation & Types
1. **Define Schema**: Create a robust TypeScript interface for comments, including support for:
   - Nested replies (one level deep or recursive).
   - User metadata (ID, Name, Avatar).
   - Interaction state (Likes, Timestamps).
2. **Create Storage Utility**: Implement a helper for saving/loading comments from `localStorage` with error handling and JSON parsing.

### Phase 2: Component Development
1. **`MotionPageComments.tsx`**:
   - **Form Section**: A sleek, auto-expanding textarea with "Send" and "Cancel" actions. Supports `Ctrl+Enter` for quick submission.
   - **Comment List**: Categorized by "Newest", "Oldest", or "Most Liked".
   - **Comment Item**: Beautifully rendered cards featuring:
     - Dynamic Avatars (initials or images).
     - Inline editing/deletion for owners.
     - Heart/Like interaction.
     - Threaded reply view.
2. **`Avatar.tsx` (Shared)**: Create a reusable avatar component that generates consistent colors based on a hash of the user's name.

### Phase 3: Integration into Motion
1. **Trigger Mechanism**: Integrate with the existing "Add comment" button in `MotionPage.tsx`.
2. **Placement**: The comments will reside at the bottom of the page content, following the standard Motion document flow, but can be easily moved to a sidebar in future iterations.
3. **User Identity**: Implement a lightweight `useUser` hook (or mock) to provide a consistent `currentUserId` and profile.

## 3. Design Aesthetics (Premium UX)

- **Typography**: Use `Inter` with proper weight hierarchy (Medium for names, Regular for text).
- **Animations**: Subtle `framer-motion` (or CSS) transitions for appearing/disappearing comments and expanding reply threads.
- **Colors**: 
  - Glassmorphism effects for the comment input.
  - Subtle hover states on interaction buttons (Like, Reply, More).
  - High-contrast indicators for "Author" badges.
- **Icons**: Standardized use of Lucide icons (`MessageSquare`, `Heart`, `MoreHorizontal`, `Trash2`, `Edit3`).

## 4. Performance & Reliability

- **Throttled Updates**: Ensure that updates to `localStorage` don't block the main thread.
- **Optimistic UI**: Comments and likes will reflect in the UI immediately before the persistence layer confirms the save.
- **Accessibility (A11y)**: Proper ARIA labels, focus management for replies, and keyboard shortcuts.

---
**Status**: Ready for implementation.
**Next Action**: Create `MotionPageComments.tsx` following this plan.
