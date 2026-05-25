# Meeting Features Integration Guide

## Quick Start - Step by Step

This guide walks through implementing all three features in order.

---

## Phase 1: Database & Backend Setup (1-2 hours)

### Step 1.1: Run Database Migration

```bash
# Copy migration file to backend
cp MIGRATION_012_meeting_history.sql backend/src/migrations/

# Run migration via your migration runner
# If using pg-migrate:
npm run migrate up --version 012

# Or if using manual psql:
psql $DATABASE_URL < backend/src/migrations/012_meeting_history.sql
```

**What this does:**
- Adds `title`, `description`, `word_count`, `speaker_count`, `is_archived`, `shared_with_motion`, `motion_page_id` columns
- Creates indices for fast queries
- Updates RLS policies

### Step 1.2: Update Meeting Controller

**File:** `backend/src/controllers/meeting.controller.ts`

Add all new controller methods from `MEETING_FEATURES_IMPLEMENTATION.md` Section 1.3:
- `getMeetingHistory()` - Paginated history
- `getMeetingReview()` - Full meeting details
- `updateMeetingMetadata()` - Edit title/description
- `toggleArchive()` - Archive/unarchive
- `deleteMeeting()` - Permanent delete
- `searchMeetings()` - Full-text search

Copy from the implementation doc and paste into your controller.

**Key points:**
- All endpoints check `user_id` for authorization
- Use Supabase queries for all database access
- Return proper error codes (404, 403, 500)

### Step 1.3: Update Meeting Routes

**File:** `backend/src/routes/meeting.routes.ts`

Replace the entire file with:

```typescript
import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as meetingController from "../controllers/meeting.controller";

const router = Router();

router.use(protect);

// Existing endpoints
router.post("/upload-url", meetingController.getUploadUrl);
router.post("/transcribe", meetingController.transcribeRecording);
router.get("/transcribe/status", meetingController.getTranscriptionStatus);
router.get("/:meetingId/recordings", meetingController.getMeetingRecordings);

// NEW endpoints for meeting history
router.get("/history", meetingController.getMeetingHistory);
router.get("/:recordingId/review", meetingController.getMeetingReview);
router.patch("/:recordingId/metadata", meetingController.updateMeetingMetadata);
router.patch("/:recordingId/archive", meetingController.toggleArchive);
router.delete("/:recordingId", meetingController.deleteMeeting);
router.get("/search/query", meetingController.searchMeetings);
router.post("/:recordingId/share-motion", meetingController.shareToMotion);

export default router;
```

### Step 1.4: Update Meeting Service

**File:** `backend/src/services/meeting.service.ts`

Add motion sharing function:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function createMotionPageFromTranscript(
  supabase: SupabaseClient,
  userId: string,
  recordingId: string,
  title: string,
  transcript: string,
  diarizedTranscript?: any
) {
  const motionPage = await supabase
    .from("motion_pages")
    .insert({
      user_id: userId,
      title: title,
      slug: title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, ""),
      content: formatTranscriptForMotion(transcript, diarizedTranscript),
      is_public: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (motionPage.error) throw motionPage.error;

  // Update meeting with reference
  await supabase
    .from("meeting_recordings")
    .update({
      shared_with_motion: true,
      motion_page_id: motionPage.data.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordingId);

  return motionPage.data;
}

function formatTranscriptForMotion(
  plainText: string,
  diarized?: any
): string {
  if (!diarized?.entries) return plainText;

  return diarized.entries
    .map((entry: any) => {
      const time = `[${entry.start_time_seconds}s]`;
      return `**Speaker ${entry.speaker_id}** ${time}\n\n${entry.transcript}`;
    })
    .join("\n\n---\n\n");
}
```

### Step 1.5: Test Backend Endpoints

```bash
# Test history endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/v1/meetings/history?page=1&limit=20

# Test search
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/meetings/search/query?q=project"

# Test review
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/v1/meetings/$RECORDING_ID/review
```

---

## Phase 2: Frontend State & Store (30 minutes)

### Step 2.1: Create Recording Store

**File:** `frontend/src/store/useRecordingStore.ts`

Copy entire content from `STORE_useRecordingStore.ts` file.

**What this does:**
- Persists recording state to localStorage
- Survives page navigation
- Provides actions to manage recording state

### Step 2.2: Add Dependencies

```bash
cd frontend

# Install react-rnd for draggable PIP
npm install react-rnd
npm install --save-dev @types/react-rnd
```

### Step 2.3: Verify Zustand is Installed

```bash
npm list zustand
# Should show zustand@4.x.x or higher
```

---

## Phase 3: Frontend Components - Part 1 (1.5 hours)

### Step 3.1: Create MeetingSidebar Component

**File:** `frontend/src/components/MeetingSidebar.tsx`

Copy entire content from `COMPONENT_MeetingSidebar.tsx`.

**Key features:**
- Displays meeting history from API
- Search functionality
- Archive/delete actions
- Pagination support

### Step 3.2: Create MeetingReviewDialog Component

**File:** `frontend/src/components/MeetingReviewDialog.tsx`

Copy entire content from `MEETING_FEATURES_IMPLEMENTATION.md` Section 1.5.

**Key features:**
- Full meeting details display
- Edit title/description
- Share to Motion button
- Download transcript option
- Diarized transcript display

### Step 3.3: Create RecordingPIP Component

**File:** `frontend/src/components/RecordingPIP.tsx`

Copy entire content from `COMPONENT_RecordingPIP.tsx`.

**Key features:**
- Draggable floating window
- Can minimize to small badge
- Shows recording timer
- Stop & process button

### Step 3.4: Create MeetingsPage Component

**File:** `frontend/src/components/MeetingsPage.tsx`

```typescript
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { MeetingDialog } from "./MeetingDialog";

export const MeetingsPage: React.FC = () => {
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <Mic className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Meeting Studio</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Record and transcribe your meetings. Access your meeting history from the sidebar.
      </p>
      <Button
        onClick={() => setIsMeetingOpen(true)}
        className="mt-4 bg-violet-600 hover:bg-violet-500"
      >
        <Mic className="h-4 w-4 mr-2" />
        Start New Recording
      </Button>

      <MeetingDialog
        open={isMeetingOpen}
        onOpenChange={setIsMeetingOpen}
      />
    </div>
  );
};
```

---

## Phase 4: Frontend Integration (1.5 hours)

### Step 4.1: Update Layout.tsx for PIP

**File:** `frontend/src/components/Layout.tsx`

```typescript
// Add imports at top
import { RecordingPIP } from "./RecordingPIP";
import { useRecordingStore } from "@/store/useRecordingStore";

// In the Layout function component:
export function Layout({ children, className, sidebar }: LayoutProps) {
  // ... existing code ...

  const { isRecording, duration, isStopping } = useRecordingStore();
  const { stopRecording } = useRecordingStore();
  const location = useLocation();

  // Check if on meeting page
  const isOnMeetingPage = location.pathname.includes("/meetings");

  return (
    <SidebarProvider>
      {sidebar || <AppSidebar />}
      <SidebarInset className="bg-background relative">
        {/* ... existing content ... */}

        {/* Recording PIP - shown when recording on non-meeting pages */}
        {isRecording && !isOnMeetingPage && (
          <RecordingPIP
            isRecording={isRecording}
            duration={duration}
            isStopping={isStopping}
            onStop={stopRecording}
          />
        )}

        <main
          className={cn(
            "flex-1 transition-all duration-300",
            isChatOpen && "pr-[400px]",
            className
          )}
        >
          {/* ... rest of content ... */}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### Step 4.2: Update MeetingRecorder.tsx

**File:** `frontend/src/components/MeetingRecorder.tsx`

Add imports:

```typescript
import { useRecordingStore } from "@/store/useRecordingStore";
```

In the component:

```typescript
export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onClose,
  meetingId
}) => {
  // ... existing state ...
  
  const {
    setIsRecording,
    setDuration,
    setRecordingId,
    setIsStopping,
  } = useRecordingStore();

  // In startRecording:
  const startRecording = async () => {
    try {
      // ... existing code ...
      setIsRecording(true); // Sync with store
      setStatus("recording");
      toast.success("Meeting capture started");
    } catch (err: any) {
      // ... existing error handling ...
    }
  };

  // Update the timer interval:
  useEffect(() => {
    if (status === "recording") {
      startTimeRef.current = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const newDuration = Math.round(
          (Date.now() - startTimeRef.current) / 1000
        );
        setDuration(newDuration); // Sync with store
        setDuration(newDuration);
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [status]);

  // In stopRecording:
  const stopRecording = () => {
    setIsStopping(true);
    // ... existing stop code ...
  };

  // When stopping completes:
  // const cleanup = () => {
  //   setIsRecording(false);
  //   setIsStopping(false);
  // };
};
```

### Step 4.3: Update AppSidebar.tsx

**File:** `frontend/src/components/AppSidebar.tsx`

Add import:

```typescript
import { MeetingSidebar } from "./MeetingSidebar";
```

In the SidebarContent, add MeetingSidebar:

```typescript
<SidebarContent>
  {/* ... existing navigation items ... */}
  
  {/* Meeting sidebar history */}
  <MeetingSidebar />
  
  {/* ... rest of content ... */}
</SidebarContent>
```

### Step 4.4: Update App.tsx Routes

**File:** `frontend/src/App.tsx`

Add import:

```typescript
import { MeetingsPage } from "./components/MeetingsPage";
```

Add route:

```typescript
<Route
  path="/meetings"
  element={
    <Layout>
      <MeetingsPage />
    </Layout>
  }
/>
```

---

## Phase 5: Testing (1-2 hours)

### Test Checklist

**Backend API Tests:**
```bash
# Get history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/meetings/history?page=1

# Search
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/search/query?q=test"

# Review
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/meetings/$RECORDING_ID/review

# Update metadata
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Meeting","description":"Notes"}' \
  http://localhost:3000/api/v1/meetings/$RECORDING_ID/metadata
```

**Frontend User Tests:**

1. **Meeting History**
   - [ ] Navigate to /meetings page
   - [ ] See sidebar with meeting list
   - [ ] Search for a meeting
   - [ ] Click meeting to open review dialog
   - [ ] Edit title and description
   - [ ] Archive a meeting
   - [ ] Delete a meeting

2. **Recording PIP**
   - [ ] Start recording on meetings page
   - [ ] PIP not visible on meeting page
   - [ ] Navigate to another page (e.g., /tasks)
   - [ ] PIP appears as floating window
   - [ ] Drag PIP around screen
   - [ ] Click minimize button
   - [ ] PIP becomes small badge with red dot
   - [ ] Click badge to expand
   - [ ] Stop recording from PIP
   - [ ] Meeting saved and appears in history

3. **Share to Motion**
   - [ ] Open a completed meeting in review dialog
   - [ ] Click "Share to Motion" button
   - [ ] Wait for Motion page creation
   - [ ] Redirected to Motion page
   - [ ] Transcript is visible and editable
   - [ ] Meeting shows as "shared_with_motion" in database

---

## Troubleshooting

### Issue: PIP not appearing when navigating away

**Solution:**
- Ensure `useRecordingStore` is being updated in MeetingRecorder
- Check that Layout.tsx is checking `location.pathname` correctly
- Verify `react-rnd` is installed

### Issue: Recording state lost on page reload

**Solution:**
- This is expected behavior (browser resets MediaRecorder)
- localStorage persists duration/recordingId but not audio stream
- User can see incomplete recordings in history

### Issue: Search not finding meetings

**Solution:**
- Check PostgreSQL full-text indices were created in migration
- Verify `transcript_text` column has content
- Try exact phrase search

### Issue: Share to Motion fails

**Solution:**
- Verify `motion_pages` table exists
- Check `user_id` foreign key constraint
- Ensure user has permission to create pages

---

## Performance Optimization Tips

1. **Pagination**: Load 20 meetings at a time, implement "Load More"
2. **Search debouncing**: Add 300ms debounce to search input
3. **Lazy loading**: Load meeting details only when review dialog opens
4. **Image optimization**: Consider generating thumbnails for long meetings

---

## Security Checklist

- [ ] All endpoints check `user_id` (done in migration)
- [ ] RLS policies enable only user access to own recordings
- [ ] Share to Motion creates private pages by default
- [ ] Delete endpoint removes S3 audio file
- [ ] No sensitive data in localStorage

---

## Next Steps After Implementation

1. **Monitor Performance**
   - Check query times with larger datasets
   - Optimize indices if needed

2. **User Feedback**
   - Test with real users
   - Adjust PIP default position based on feedback
   - Add more sharing options

3. **Future Features**
   - AI-powered summaries
   - Meeting templates
   - Participant management
   - Export to other formats

---

## Support

If you encounter issues:

1. Check the implementation guide for your specific component
2. Review the API endpoint documentation
3. Check browser console for errors
4. Check backend logs for API errors
5. Verify database migration was run successfully

Good luck with implementation! 🚀