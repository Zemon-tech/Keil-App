/**
 * useStreamResume.ts
 *
 * Handles the "resume stream on reconnect" pattern.
 *
 * When the user returns to a chat:
 *  1. We check if the thread has a persisted stream session.
 *  2. If the session is "streaming" (still running), we replay missed chunks
 *     and then let useChat reconnect to the live stream.
 *  3. If the session is "complete" we replay any missed chunks only.
 *  4. Chunks are merged into the existing messages array via setMessages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001/api")
  .replace(/\/$/, "")
  .replace(/\/api\/?$/, "");

const RESUME_URL = `${API_BASE}/chat/resume`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamChunk {
  index: number;
  type: string;
  data: any;
}

interface ResumeData {
  threadId: string;
  status: "streaming" | "complete" | "error" | "unknown";
  totalChunks: number;
  latestChunkIndex: number;
  chunks: StreamChunk[];
  isComplete: boolean;
  isStreaming: boolean;
}

interface UseStreamResumeOptions {
  threadId: string;
  /** Current highest chunk index the client has already received (-1 = none) */
  fromChunkIndex?: number;
  /** Called with reassembled text delta when chunks are replayed */
  onReplayChunk?: (chunk: StreamChunk) => void;
  /** Called when replay is done (with final status) */
  onReplayComplete?: (status: ResumeData["status"], totalText: string) => void;
}

export interface StreamResumeResult {
  /** Whether a resume fetch is in progress */
  isResuming: boolean;
  /** Status of the persisted stream session */
  streamStatus: ResumeData["status"] | null;
  /** Total chunks persisted server-side */
  totalChunks: number;
  /** Replay missed chunks manually */
  resume: () => Promise<void>;
  /** Assembled text from all replayed text-delta chunks */
  replayedText: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStreamResume({
  threadId,
  fromChunkIndex = 0,
  onReplayChunk,
  onReplayComplete,
}: UseStreamResumeOptions): StreamResumeResult {
  const [isResuming, setIsResuming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<ResumeData["status"] | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);
  const [replayedText, setReplayedText] = useState("");

  const hasResumedRef = useRef(false);

  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : null;
  }, []);

  const resume = useCallback(async () => {
    if (isResuming) return;
    setIsResuming(true);
    setReplayedText("");

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        console.warn("[StreamResume] No auth token — skipping resume");
        return;
      }

      const url = `${RESUME_URL}?threadId=${encodeURIComponent(threadId)}&fromIndex=${fromChunkIndex}`;
      const res = await fetch(url, {
        headers: { Authorization: authHeader },
      });

      if (!res.ok) {
        console.warn("[StreamResume] Resume fetch failed:", res.status);
        return;
      }

      const json = await res.json();
      if (!json.success || !json.data) return;

      const data: ResumeData = json.data;

      setStreamStatus(data.status);
      setTotalChunks(data.totalChunks);

      // Replay chunks in order
      let accumulatedText = "";
      for (const chunk of data.chunks) {
        if (chunk.type === "text-delta" && chunk.data?.textDelta) {
          accumulatedText += chunk.data.textDelta;
        }
        onReplayChunk?.(chunk);
      }

      setReplayedText(accumulatedText);
      onReplayComplete?.(data.status, accumulatedText);
    } catch (err) {
      console.error("[StreamResume] Error during resume:", err);
    } finally {
      setIsResuming(false);
    }
  }, [threadId, fromChunkIndex, isResuming, getAuthHeader, onReplayChunk, onReplayComplete]);

  // Auto-resume on mount / threadId change
  useEffect(() => {
    hasResumedRef.current = false;
  }, [threadId]);

  useEffect(() => {
    if (hasResumedRef.current) return;
    hasResumedRef.current = true;
    resume();
    // Only run on mount and threadId change — don't re-run on resume change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  return {
    isResuming,
    streamStatus,
    totalChunks,
    resume,
    replayedText,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reassemble a list of chunks into a single text string.
 * Useful for reconstructing the full assistant response from persisted chunks.
 */
export function chunksToText(chunks: StreamChunk[]): string {
  return chunks
    .filter((c) => c.type === "text-delta" && c.data?.textDelta)
    .map((c) => c.data.textDelta as string)
    .join("");
}

/**
 * Extract agent activity events from replayed chunks.
 */
export function chunksToActivities(chunks: StreamChunk[]) {
  return chunks
    .filter((c) => c.type === "data-agent-activity")
    .map((c) => c.data);
}
