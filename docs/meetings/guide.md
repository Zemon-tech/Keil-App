# Meeting Features Implementation Guide

## Overview
This document outlines the complete implementation for three major features:
1. **Meeting Sidebar History** - Persistent sidebar with meeting history and review dialog
2. **Recording PIP (Picture-in-Picture)** - Floating recording that persists across page navigation
3. **Share to Motion** - Export transcripts as Motion pages

---

## Feature 1: Meeting Sidebar History

### 1.1 Database Migration
**File:** `backend/src/migrations/012_meeting_history.sql`

Add metadata fields and improve the schema:

```sql
-- Migration: 012_meeting_history.sql
-- Description: Add meeting history and metadata tracking

ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS word_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS speaker_count INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shared_with_motion BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS motion_page_id UUID REFERENCES public.motion_pages(id) ON DELETE SET NULL;

-- Create index for faster history queries
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_user_created 
ON public.meeting_recordings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_recordings_archived 
ON public.meeting_recordings(user_id, is_archived, created_at DESC);
```

### 1.2 Backend API Routes
**File:** `backend/src/routes/meeting.routes.ts`

Add new endpoints:

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

// NEW ENDPOINTS
// Get all meeting history for user
router.get("/history", meetingController.getMeetingHistory);

// Get specific meeting details for review
router.get("/:recordingId/review", meetingController.getMeetingReview);

// Update meeting metadata (title, description)
router.patch("/:recordingId/metadata", meetingController.updateMeetingMetadata);

// Archive/unarchive meeting
router.patch("/:recordingId/archive", meetingController.toggleArchive);

// Delete meeting
router.delete("/:recordingId", meetingController.deleteMeeting);

// Search meetings
router.get("/search/query", meetingController.searchMeetings);

export default router;
```

### 1.3 Backend Controllers
**File:** `backend/src/controllers/meeting.controller.ts`

Add new controller methods:

```typescript
// Add these methods to the existing meeting controller

/**
 * GET /v1/meetings/history
 * Retrieve paginated meeting history for authenticated user
 */
export async function getMeetingHistory(req: AuthRequest, res: Response) {
  try {
    const { page = 1, limit = 20, archived = false } = req.query;
    const userId = req.user.id;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const { data, error } = await supabase
      .from("meeting_recordings")
      .select(
        `
        id,
        title,
        description,
        created_at,
        audio_duration_seconds,
        word_count,
        speaker_count,
        language_detected,
        thumbnail_url,
        transcription_status
        `,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("is_archived", archived === "true")
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);
    
    if (error) throw error;
    
    return res.json({
      data: {
        recordings: data || [],
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: data?.length || 0
        }
      }
    });
  } catch (err: any) {
    console.error("getMeetingHistory error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /v1/meetings/:recordingId/review
 * Retrieve full meeting details for review dialog
 */
export async function getMeetingReview(req: AuthRequest, res: Response) {
  try {
    const { recordingId } = req.params;
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from("meeting_recordings")
      .select("*")
      .eq("id", recordingId)
      .eq("user_id", userId)
      .single();
    
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    
    return res.json({ data });
  } catch (err: any) {
    console.error("getMeetingReview error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /v1/meetings/:recordingId/metadata
 * Update meeting title and description
 */
export async function updateMeetingMetadata(req: AuthRequest, res: Response) {
  try {
    const { recordingId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;
    
    // Verify ownership
    const { data: existing } = await supabase
      .from("meeting_recordings")
      .select("id")
      .eq("id", recordingId)
      .eq("user_id", userId)
      .single();
    
    if (!existing) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    const { data, error } = await supabase
      .from("meeting_recordings")
      .update({
        title: title || `Meeting - ${new Date().toLocaleDateString()}`,
        description,
        updated_at: new Date().toISOString()
      })
      .eq("id", recordingId)
      .select()
      .single();
    
    if (error) throw error;
    
    return res.json({ data });
  } catch (err: any) {
    console.error("updateMeetingMetadata error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /v1/meetings/:recordingId/archive
 * Toggle archive status
 */
export async function toggleArchive(req: AuthRequest, res: Response) {
  try {
    const { recordingId } = req.params;
    const userId = req.user.id;
    
    // Get current state
    const { data: current, error: getError } = await supabase
      .from("meeting_recordings")
      .select("is_archived")
      .eq("id", recordingId)
      .eq("user_id", userId)
      .single();
    
    if (getError) throw getError;
    if (!current) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    const { data, error } = await supabase
      .from("meeting_recordings")
      .update({
        is_archived: !current.is_archived,
        updated_at: new Date().toISOString()
      })
      .eq("id", recordingId)
      .select()
      .single();
    
    if (error) throw error;
    
    return res.json({ data });
  } catch (err: any) {
    console.error("toggleArchive error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /v1/meetings/:recordingId
 * Permanently delete a meeting recording
 */
export async function deleteMeeting(req: AuthRequest, res: Response) {
  try {
    const { recordingId } = req.params;
    const userId = req.user.id;
    
    // Get the S3 key before deleting
    const { data: recording, error: getError } = await supabase
      .from("meeting_recordings")
      .select("audio_s3_key")
      .eq("id", recordingId)
      .eq("user_id", userId)
      .single();
    
    if (getError) throw getError;
    if (!recording) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    // Delete from S3
    if (recording.audio_s3_key) {
      const s3 = getS3Client();
      await s3.deleteObject({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: recording.audio_s3_key
      }).promise();
    }
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from("meeting_recordings")
      .delete()
      .eq("id", recordingId)
      .eq("user_id", userId);
    
    if (deleteError) throw deleteError;
    
    return res.json({ success: true, message: "Meeting deleted" });
  } catch (err: any) {
    console.error("deleteMeeting error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /v1/meetings/search/query
 * Search meetings by title or transcript content
 */
export async function searchMeetings(req: AuthRequest, res: Response) {
  try {
    const { q } = req.query;
    const userId = req.user.id;
    
    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }
    
    const { data, error } = await supabase
      .from("meeting_recordings")
      .select("id, title, created_at, audio_duration_seconds, word_count")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .or(`title.ilike.%${q}%,transcript_text.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    return res.json({ data: data || [] });
  } catch (err: any) {
    console.error("searchMeetings error:", err);
    res.status(500).json({ error: err.message });
  }
}
```

### 1.4 Frontend: Meeting History Sidebar
**File:** `frontend/src/components/MeetingSidebar.tsx` (NEW)

```typescript
import React, { useState, useEffect } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Mic,
  MoreVertical,
  Archive,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { MeetingReviewDialog } from "./MeetingReviewDialog";

interface MeetingRecord {
  id: string;
  title: string;
  created_at: string;
  audio_duration_seconds: number;
  word_count: number;
  speaker_count: number;
  language_detected: string;
  is_archived: boolean;
}

export const MeetingSidebar: React.FC = () => {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, [showArchived]);

  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("v1/meetings/history", {
        params: {
          archived: showArchived,
          limit: 50,
          page: 1,
        },
      });
      setMeetings(response.data.data.recordings);
    } catch (err) {
      console.error("Failed to load meetings:", err);
      toast.error("Failed to load meeting history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      loadMeetings();
      return;
    }

    try {
      const response = await api.get("v1/meetings/search/query", {
        params: { q: query },
      });
      setMeetings(response.data.data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleDelete = async (meetingId: string) => {
    if (!confirm("Delete this meeting? This cannot be undone.")) return;

    try {
      await api.delete(`v1/meetings/${meetingId}`);
      setMeetings(meetings.filter((m) => m.id !== meetingId));
      toast.success("Meeting deleted");
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete meeting");
    }
  };

  const handleArchive = async (meeting: MeetingRecord) => {
    try {
      const response = await api.patch(
        `v1/meetings/${meeting.id}/archive`
      );
      // Remove from current view
      setMeetings(meetings.filter((m) => m.id !== meeting.id));
      toast.success(
        response.data.data.is_archived ? "Meeting archived" : "Meeting unarchived"
      );
    } catch (err) {
      console.error("Archive failed:", err);
      toast.error("Failed to update meeting");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <SidebarGroup>
        <div className="flex items-center justify-between">
          <SidebarGroupLabel className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Meetings
          </SidebarGroupLabel>
        </div>

        {/* Search Bar */}
        <div className="relative px-2 mb-2">
          <Search className="absolute left-4 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <SidebarGroupContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-6 px-4 text-center">
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? "No meetings found"
                  : showArchived
                    ? "No archived meetings"
                    : "No meetings yet"}
              </p>
            </div>
          ) : (
            <SidebarMenu>
              {meetings.map((meeting) => (
                <SidebarMenuItem key={meeting.id}>
                  <SidebarMenuButton
                    onClick={() => setSelectedMeeting(meeting.id)}
                    className="flex-1 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {meeting.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(meeting.created_at)} •{" "}
                        {formatDuration(meeting.audio_duration_seconds)}
                      </p>
                    </div>
                  </SidebarMenuButton>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuBadge className="cursor-pointer">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </SidebarMenuBadge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => handleArchive(meeting)}
                        className="cursor-pointer"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {meeting.is_archived ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(meeting.id)}
                        className="cursor-pointer text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Review Dialog */}
      {selectedMeeting && (
        <MeetingReviewDialog
          meetingId={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </>
  );
};
```

### 1.5 Frontend: Meeting Review Dialog
**File:** `frontend/src/components/MeetingReviewDialog.tsx` (NEW)

```typescript
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import {
  Loader2,
  Download,
  Share2,
  Edit2,
  Save,
  X,
  Mic,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MeetingReview {
  id: string;
  title: string;
  description: string;
  created_at: string;
  audio_duration_seconds: number;
  word_count: number;
  speaker_count: number;
  language_detected: string;
  transcript_text: string;
  transcript_diarized: any;
  audio_s3_key: string;
}

interface MeetingReviewDialogProps {
  meetingId: string;
  onClose: () => void;
}

export const MeetingReviewDialog: React.FC<MeetingReviewDialogProps> = ({
  meetingId,
  onClose,
}) => {
  const [meeting, setMeeting] = useState<MeetingReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadMeetingDetails();
  }, [meetingId]);

  const loadMeetingDetails = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`v1/meetings/${meetingId}/review`);
      setMeeting(response.data.data);
      setEditedTitle(response.data.data.title);
      setEditedDescription(response.data.data.description);
    } catch (err) {
      console.error("Failed to load meeting:", err);
      toast.error("Failed to load meeting details");
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!meeting) return;

    try {
      setIsSaving(true);
      const response = await api.patch(`v1/meetings/${meetingId}/metadata`, {
        title: editedTitle,
        description: editedDescription,
      });
      setMeeting(response.data.data);
      setIsEditing(false);
      toast.success("Meeting updated");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h > 0 ? h : null,
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ]
      .filter((x) => x !== null)
      .join(":");
  };

  const formatSegmentTime = (seconds: number | string) => {
    const secs = typeof seconds === "string" ? parseFloat(seconds) : seconds;
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!meeting) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b p-6 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-semibold mb-2"
                  placeholder="Meeting title"
                />
              ) : (
                <h2 className="text-xl font-semibold">{meeting.title}</h2>
              )}
              <p className="text-sm text-muted-foreground">
                {new Date(meeting.created_at).toLocaleString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="grid grid-cols-3 gap-6 p-6">
            {/* Left: Metadata & Stats */}
            <div className="col-span-1 space-y-6">
              {/* Orb */}
              <div className="flex justify-center">
                <VoicePoweredOrb isRecording={false} />
              </div>

              {/* Duration */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Duration
                </p>
                <p className="text-2xl font-mono">
                  {formatTime(meeting.audio_duration_seconds)}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="space-y-3">
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Speakers
                  </p>
                  <p className="text-lg font-semibold">
                    {meeting.speaker_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Language
                  </p>
                  <p className="text-sm">{meeting.language_detected}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Words
                  </p>
                  <p className="text-sm">{meeting.word_count}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 border-t pt-3">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleSaveMetadata}
                      disabled={isSaving}
                      size="sm"
                      className="w-full"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      onClick={() => setIsEditing(false)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Right: Transcript */}
            <div className="col-span-2 space-y-4">
              {isEditing && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase block mb-2">
                    Description
                  </label>
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Add meeting notes..."
                    className="text-sm min-h-20"
                  />
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-3">
                  Transcript
                </h3>
                <div className="space-y-4 bg-black/2.5 dark:bg-white/2.5 p-4 rounded-lg">
                  {meeting.transcript_diarized?.entries &&
                  meeting.transcript_diarized.entries.length > 0 ? (
                    meeting.transcript_diarized.entries.map(
                      (entry: any, index: number) => (
                        <div
                          key={index}
                          className="flex gap-3 animate-in fade-in"
                        >
                          <div className="text-xs font-medium text-muted-foreground shrink-0 min-w-max">
                            Speaker {entry.speaker_id}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">
                              {formatSegmentTime(entry.start_time_seconds)} -{" "}
                              {formatSegmentTime(entry.end_time_seconds)}
                            </p>
                            <p className="text-sm text-foreground">
                              {entry.transcript}
                            </p>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-sm text-foreground/60 whitespace-pre-wrap">
                      {meeting.transcript_text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer with Share to Motion */}
        <DialogFooter className="border-t p-4 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-500">
            <Share2 className="h-4 w-4 mr-2" />
            Share to Motion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Feature 2: Recording PIP (Picture-in-Picture)

### 2.1 Frontend: Recording PIP Component
**File:** `frontend/src/components/RecordingPIP.tsx` (NEW)

```typescript
import React, { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { Button } from "@/components/ui/button";
import { Pause, Play, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordingPIPProps {
  isRecording: boolean;
  duration: number;
  onStop: () => void;
  onMinimize?: () => void;
}

export const RecordingPIP: React.FC<RecordingPIPProps> = ({
  isRecording,
  duration,
  onStop,
  onMinimize,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const rndRef = useRef<any>(null);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h > 0 ? h : null,
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ]
      .filter((x) => x !== null)
      .join(":");
  };

  if (isMinimized) {
    return (
      <Rnd
        ref={rndRef}
        default={{
          x: window.innerWidth - 80,
          y: window.innerHeight - 100,
          width: 60,
          height: 60,
        }}
        minWidth={60}
        minHeight={60}
        dragHandleClassName="cursor-grab active:cursor-grabbing"
        bounds="window"
      >
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-full w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg border-2 border-white/20 hover:border-white/40 transition-all group relative">
          {isRecording && (
            <div className="absolute inset-0 rounded-full animate-pulse bg-red-500/20"></div>
          )}

          {/* Red recording dot */}
          <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>

          {/* Click to expand */}
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Expand recording"
          >
            <Minimize2 className="h-3 w-3 text-white" />
          </button>
        </div>
      </Rnd>
    );
  }

  return (
    <Rnd
      ref={rndRef}
      default={{
        x: window.innerWidth - 340,
        y: window.innerHeight - 420,
        width: 320,
        height: 400,
      }}
      minWidth={280}
      minHeight={320}
      dragHandleClassName="cursor-grab active:cursor-grabbing"
      bounds="window"
    >
      <div className="h-full bg-white dark:bg-[#0f0f11] rounded-xl shadow-2xl border border-black/8 dark:border-white/8 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-black/6 dark:border-white/6 shrink-0 flex items-center justify-between cursor-grab active:cursor-grabbing">
          <div>
            <h3 className="text-xs font-semibold tracking-[0.05em] uppercase text-foreground">
              Recording
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatTime(duration)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(true)}
            className="h-6 w-6 p-0"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Orb */}
        <div className="flex-1 flex items-center justify-center py-6 min-h-0">
          <VoicePoweredOrb isRecording={isRecording} />
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-black/6 dark:border-white/6 shrink-0 space-y-2">
          <Button
            onClick={onStop}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium tracking-[0.06em] uppercase h-8"
          >
            Stop & Process
          </Button>

          {/* Quick status */}
          <div className="text-[11px] text-center text-muted-foreground">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
            Recording in progress
          </div>
        </div>
      </div>
    </Rnd>
  );
};
```

### 2.2 Frontend: Update Layout.tsx for PIP Support
**File:** `frontend/src/components/Layout.tsx` (UPDATE)

Add recording state management at the layout level:

```typescript
// At the top of the Layout component, add:
import { RecordingPIP } from "./RecordingPIP";
import { useRecordingStore } from "@/store/useRecordingStore"; // NEW

export function Layout({ children, className, sidebar }: LayoutProps) {
  // ... existing code ...
  
  const {
    isRecording,
    duration,
    stopRecording,
    recordingId,
  } = useRecordingStore();

  return (
    <SidebarProvider>
      {sidebar || <AppSidebar />}
      <SidebarInset className="bg-background relative">
        {/* ... existing code ... */}

        {/* Recording PIP - shown when recording on non-meeting pages */}
        {isRecording && !location.pathname.includes("/meetings") && (
          <RecordingPIP
            isRecording={isRecording}
            duration={duration}
            onStop={stopRecording}
          />
        )}

        {/* ... rest of existing code ... */}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### 2.3 Frontend: Recording State Store
**File:** `frontend/src/store/useRecordingStore.ts` (NEW)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecordingState {
  // Recording state
  isRecording: boolean;
  duration: number;
  recordingId: string | null;

  // Controls
  startRecording: () => void;
  stopRecording: () => Promise<void>;
  setDuration: (duration: number) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingId: (id: string | null) => void;

  // Restore state from localStorage
  restoreFromStorage: () => void;
}

export const useRecordingStore = create<RecordingState>()(
  persist(
    (set, get) => ({
      isRecording: false,
      duration: 0,
      recordingId: null,

      startRecording: () => {
        set({ isRecording: true, duration: 0 });
      },

      stopRecording: async () => {
        set({ isRecording: false });
        // Handle actual stop in MeetingRecorder
      },

      setDuration: (duration: number) => {
        set({ duration });
      },

      setIsRecording: (recording: boolean) => {
        set({ isRecording: recording });
      },

      setRecordingId: (id: string | null) => {
        set({ recordingId: id });
      },

      restoreFromStorage: () => {
        // Called on app init to restore recording state
      },
    }),
    {
      name: "recording-store",
      partialize: (state) => ({
        isRecording: state.isRecording,
        duration: state.duration,
        recordingId: state.recordingId,
      }),
    }
  )
);
```

### 2.4 Frontend: Update MeetingRecorder to use Store
**File:** `frontend/src/components/MeetingRecorder.tsx` (UPDATE)

Add integration with recording store:

```typescript
import { useRecordingStore } from "@/store/useRecordingStore";

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onClose,
  meetingId
}) => {
  // ... existing state ...
  const { setIsRecording, setDuration, setRecordingId } = useRecordingStore();
  const location = useLocation();
  const isOnMeetingPage = location.pathname.includes("/meetings");

  // In startRecording:
  const startRecording = async () => {
    try {
      // ... existing code ...
      setIsRecording(true); // Update store
      setStatus("recording");
      toast.success("Meeting capture started");
    } catch (err: any) {
      // ... existing error handling ...
    }
  };

  // In timer interval:
  useEffect(() => {
    if (status === "recording") {
      timerIntervalRef.current = window.setInterval(() => {
        const newDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        setDuration(newDuration); // Update store
        setDuration(newDuration);
      }, 1000);
    }
  }, [status]);

  // In stopRecording:
  const stopRecording = () => {
    // ... existing code ...
    setIsRecording(false); // Update store
  };
};
```

---

## Feature 3: Share Transcript to Motion

### 3.1 Backend: Motion Integration
**File:** `backend/src/services/motion.service.ts` (UPDATE/CREATE)

Add transcript sharing capability:

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
  try {
    // Create Motion page
    const { data: motionPage, error: pageError } = await supabase
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

    if (pageError) throw pageError;

    // Update meeting record with Motion page reference
    const { error: updateError } = await supabase
      .from("meeting_recordings")
      .update({
        shared_with_motion: true,
        motion_page_id: motionPage.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);

    if (updateError) throw updateError;

    return motionPage;
  } catch (err) {
    console.error("Failed to create Motion page:", err);
    throw err;
  }
}

function formatTranscriptForMotion(
  plainText: string,
  diarized?: any
): string {
  if (!diarized || !diarized.entries) {
    return plainText;
  }

  // Format as markdown with speaker labels
  const formatted = diarized.entries
    .map((entry: any) => {
      const time = `[${entry.start_time_seconds}s - ${entry.end_time_seconds}s]`;
      return `**Speaker ${entry.speaker_id}** ${time}\n\n${entry.transcript}\n\n---\n`;
    })
    .join("\n");

  return formatted;
}
```

### 3.2 Backend: API Endpoint
**File:** `backend/src/controllers/meeting.controller.ts` (ADD)

```typescript
/**
 * POST /v1/meetings/:recordingId/share-motion
 * Create a Motion page from meeting transcript
 */
export async function shareToMotion(req: AuthRequest, res: Response) {
  try {
    const { recordingId } = req.params;
    const userId = req.user.id;

    // Get the recording
    const { data: recording, error: getError } = await supabase
      .from("meeting_recordings")
      .select("*")
      .eq("id", recordingId)
      .eq("user_id", userId)
      .single();

    if (getError) throw getError;
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Create Motion page
    const motionPage = await createMotionPageFromTranscript(
      supabase,
      userId,
      recordingId,
      recording.title,
      recording.transcript_text,
      recording.transcript_diarized
    );

    return res.json({
      data: motionPage,
      message: "Transcript shared to Motion successfully",
    });
  } catch (err: any) {
    console.error("shareToMotion error:", err);
    res.status(500).json({ error: err.message });
  }
}
```

**File:** `backend/src/routes/meeting.routes.ts` (UPDATE)

```typescript
// Add to router:
router.post("/:recordingId/share-motion", meetingController.shareToMotion);
```

### 3.3 Frontend: Share to Motion Button
**File:** `frontend/src/components/MeetingReviewDialog.tsx` (UPDATE)

Add share functionality:

```typescript
import { useNavigate } from "react-router-dom";

interface MeetingReviewDialogProps {
  meetingId: string;
  onClose: () => void;
}

export const MeetingReviewDialog: React.FC<MeetingReviewDialogProps> = ({
  meetingId,
  onClose,
}) => {
  // ... existing state ...
  const [isSharing, setIsSharing] = useState(false);
  const navigate = useNavigate();

  const handleShareToMotion = async () => {
    if (!meeting) return;

    try {
      setIsSharing(true);
      const response = await api.post(
        `v1/meetings/${meetingId}/share-motion`
      );

      const motionPage = response.data.data;
      toast.success("Transcript shared to Motion!");

      // Navigate to the newly created Motion page
      setTimeout(() => {
        navigate(`/motion/${motionPage.id}`);
        onClose();
      }, 500);
    } catch (err) {
      console.error("Share failed:", err);
      toast.error("Failed to share to Motion");
    } finally {
      setIsSharing(false);
    }
  };

  // In the DialogFooter:
  return (
    <>
      {/* ... existing content ... */}
      <DialogFooter className="border-t p-4 shrink-0">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={handleShareToMotion}
          disabled={isSharing}
          className="bg-violet-600 hover:bg-violet-500"
        >
          {isSharing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4 mr-2" />
          )}
          Share to Motion
        </Button>
      </DialogFooter>
    </>
  );
};
```

---

## Integration: Update App Routes

**File:** `frontend/src/App.tsx` (UPDATE)

Add a dedicated meetings page route:

```typescript
import { MeetingsPage } from "./components/MeetingsPage";

// In the routes section, add:
<Route
  path="/meetings"
  element={
    <Layout>
      <MeetingsPage />
    </Layout>
  }
/>
```

### Create MeetingsPage Component
**File:** `frontend/src/components/MeetingsPage.tsx` (NEW)

```typescript
import React from "react";
import { MeetingSidebar } from "./MeetingSidebar";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { MeetingDialog } from "./MeetingDialog";
import { useState } from "react";

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

## Integration: Update AppSidebar
**File:** `frontend/src/components/AppSidebar.tsx` (UPDATE)

Update the meetings navigation item and add sidebar support:

```typescript
// Import the meeting sidebar
import { MeetingSidebar } from "./MeetingSidebar";

// In the sidebar navigation handler:
const handleNavigationClick = (item: any) => {
  if (item.action === "meetings") {
    setIsMeetingOpen(true); // Open dialog OR navigate to /meetings
  }
};

// In the SidebarContent, add:
<MeetingSidebar />
```

---

## Database Migrations Summary

### Run these in order:

```bash
# 1. Add meeting metadata and history support
psql $DATABASE_URL < backend/src/migrations/012_meeting_history.sql

# 2. Create indices for performance
psql $DATABASE_URL < backend/src/migrations/013_meeting_indices.sql

# 3. Update motion_pages if needed for meeting references
psql $DATABASE_URL < backend/src/migrations/014_motion_meeting_ref.sql
```

---

## Environment Variables

Add to `.env.local` if needed:

```env
VITE_API_BASE_URL=http://localhost:3000/api
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

---

## Testing Checklist

### Feature 1: Meeting History
- [ ] Records saved with title and metadata
- [ ] Sidebar displays list of meetings
- [ ] Click meeting opens review dialog
- [ ] Search functionality works
- [ ] Archive/unarchive works
- [ ] Delete functionality works

### Feature 2: Recording PIP
- [ ] Recording starts and shows in PIP on non-meeting pages
- [ ] Duration timer updates
- [ ] Can minimize to small badge
- [ ] Can drag PIP around
- [ ] Stop button works
- [ ] PIP persists across navigation

### Feature 3: Share to Motion
- [ ] Share button visible in review dialog
- [ ] Creates Motion page with transcript
- [ ] Navigates to new Motion page
- [ ] Transcript is editable in Motion
- [ ] Diarized format preserved

---

## File Structure Summary

```
frontend/
├── src/
│   ├── components/
│   │   ├── MeetingRecorder.tsx (UPDATE)
│   │   ├── MeetingDialog.tsx (existing)
│   │   ├── MeetingSidebar.tsx (NEW)
│   │   ├── MeetingReviewDialog.tsx (NEW)
│   │   ├── RecordingPIP.tsx (NEW)
│   │   ├── MeetingsPage.tsx (NEW)
│   │   ├── Layout.tsx (UPDATE)
│   │   └── AppSidebar.tsx (UPDATE)
│   ├── store/
│   │   └── useRecordingStore.ts (NEW)
│   └── App.tsx (UPDATE)
│
backend/
├── src/
│   ├── controllers/
│   │   └── meeting.controller.ts (UPDATE)
│   ├── services/
│   │   ├── meeting.service.ts (UPDATE)
│   │   └── motion.service.ts (UPDATE)
│   ├── routes/
│   │   └── meeting.routes.ts (UPDATE)
│   └── migrations/
│       ├── 012_meeting_history.sql (NEW)
│       ├── 013_meeting_indices.sql (NEW)
│       └── 014_motion_meeting_ref.sql (NEW)
```

---

## Notes

- **PIP Library**: Uses `react-rnd` for draggable/resizable window. Ensure it's installed:
  ```bash
  npm install react-rnd
  npm install --save-dev @types/react-rnd
  ```

- **State Persistence**: Recording state is persisted to localStorage via Zustand, so it survives page navigation

- **Real-time Duration**: Duration updates via interval, synced with store to show in PIP

- **Transcript Formatting**: Diarized transcripts are formatted as markdown in Motion for editability

- **Motion Integration**: Requires `motion_pages` table to exist. Ensure it has `user_id`, `content`, `slug` fields

---

## API Endpoints Summary

### Meeting History
```
GET    /v1/meetings/history?page=1&limit=20&archived=false
GET    /v1/meetings/:recordingId/review
PATCH  /v1/meetings/:recordingId/metadata
PATCH  /v1/meetings/:recordingId/archive
DELETE /v1/meetings/:recordingId
GET    /v1/meetings/search/query?q=search_term
POST   /v1/meetings/:recordingId/share-motion
```

---

## Future Enhancements

1. **Real-time transcription** - Show transcript as user speaks
2. **Speaker identification** - Automatic speaker name detection
3. **Meeting summaries** - AI-generated summary via Claude API
4. **Email sharing** - Send meeting transcript via email
5. **Meeting annotations** - Add notes at specific timestamps
6. **Meeting templates** - Pre-created templates for recurring meetings
7. **Integration with Calendar** - Link recordings to calendar events