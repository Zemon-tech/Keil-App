import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetingRecordingDTO {
  id: string;
  user_id: string;
  meeting_id: string | null;
  audio_s3_key: string;
  audio_duration_seconds: number | null;
  sarvam_job_id: string | null;
  transcription_status: string;
  transcript_text: string | null;
  transcript_diarized: any | null;
  language_detected: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingHistoryResponse {
  recordings: MeetingRecordingDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const meetingKeys = {
  all: ["meetings"] as const,
  history: (page: number, limit: number) =>
    [...meetingKeys.all, "history", page, limit] as const,
  search: (query: string) =>
    [...meetingKeys.all, "search", query] as const,
  recording: (id: string) =>
    [...meetingKeys.all, "recording", id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches paginated meeting history for the authenticated user.
 */
export function useMeetingHistory(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: meetingKeys.history(page, limit),
    queryFn: async (): Promise<MeetingHistoryResponse> => {
      const res = await api.get("v1/meetings/history", {
        params: { page, limit },
      });
      return res.data.data;
    },
  });
}

/**
 * Searches meetings by transcript content.
 */
export function useMeetingSearch(query: string) {
  return useQuery({
    queryKey: meetingKeys.search(query),
    queryFn: async (): Promise<MeetingRecordingDTO[]> => {
      const res = await api.get("v1/meetings/search/query", {
        params: { q: query },
      });
      return res.data.data;
    },
    enabled: query.trim().length > 0,
  });
}

/**
 * Fetches a single recording by ID for review.
 */
export function useMeetingRecording(recordingId: string | null) {
  return useQuery({
    queryKey: meetingKeys.recording(recordingId ?? ""),
    queryFn: async (): Promise<MeetingRecordingDTO> => {
      const res = await api.get(`v1/meetings/recording/${recordingId}/review`);
      return res.data.data;
    },
    enabled: !!recordingId,
  });
}

/**
 * Deletes a recording permanently (both S3 file and database entry).
 */
export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const res = await api.delete(`v1/meetings/recording/${recordingId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
}

/**
 * Cancels/stops active transcription of a recording.
 */
export function useCancelTranscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const res = await api.post(`v1/meetings/recording/${recordingId}/cancel-transcription`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
}
