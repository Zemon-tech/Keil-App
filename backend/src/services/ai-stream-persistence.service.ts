/**
 * ai-stream-persistence.service.ts
 *
 * Persists AI stream chunks to the DB as they are produced so the client
 * can replay missed chunks after a disconnect and reconnect seamlessly.
 *
 * Flow:
 *  1. Request comes in → startStreamSession(threadId, userId)
 *  2. Each chunk → persistChunk(threadId, userId, chunkIndex, chunk)
 *  3. Stream finishes → finishStreamSession(threadId, totalChunks)
 *  4. Client reconnects → getStreamStatus + getChunksSince(threadId, fromIndex)
 */

import pool from "../config/pg";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StreamStatus = "streaming" | "complete" | "error";

export interface StreamChunkRow {
  chunk_index: number;
  chunk_type: string;
  chunk_data: any;
  created_at: string;
}

export interface StreamSession {
  thread_id: string;
  user_id: string;
  status: StreamStatus;
  total_chunks: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

// ─── Session management ───────────────────────────────────────────────────────

export async function startStreamSession(
  threadId: string,
  userId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO public.ai_stream_sessions (thread_id, user_id, status, total_chunks, started_at)
     VALUES ($1, $2, 'streaming', 0, NOW())
     ON CONFLICT (thread_id)
     DO UPDATE SET status = 'streaming', total_chunks = 0, started_at = NOW(), finished_at = NULL, error_message = NULL`,
    [threadId, userId]
  );
}

export async function finishStreamSession(
  threadId: string,
  totalChunks: number
): Promise<void> {
  await pool.query(
    `UPDATE public.ai_stream_sessions
     SET status = 'complete', total_chunks = $2, finished_at = NOW()
     WHERE thread_id = $1`,
    [threadId, totalChunks]
  );
}

export async function errorStreamSession(
  threadId: string,
  errorMessage: string,
  chunksWritten: number
): Promise<void> {
  await pool.query(
    `UPDATE public.ai_stream_sessions
     SET status = 'error', error_message = $2, total_chunks = $3, finished_at = NOW()
     WHERE thread_id = $1`,
    [threadId, errorMessage, chunksWritten]
  );
}

export async function getStreamSession(
  threadId: string,
  userId: string
): Promise<StreamSession | null> {
  const result = await pool.query(
    `SELECT * FROM public.ai_stream_sessions
     WHERE thread_id = $1 AND user_id = $2`,
    [threadId, userId]
  );
  return result.rows[0] ?? null;
}

// ─── Chunk persistence ────────────────────────────────────────────────────────

export async function persistChunk(
  threadId: string,
  userId: string,
  chunkIndex: number,
  chunkType: string,
  chunkData: any
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.ai_stream_chunks
         (thread_id, user_id, chunk_index, chunk_type, chunk_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (thread_id, chunk_index) DO NOTHING`,
      [threadId, userId, chunkIndex, chunkType, JSON.stringify(chunkData)]
    );
  } catch {
    // Never block the stream over a persistence failure
  }
}

export async function getChunksSince(
  threadId: string,
  userId: string,
  fromIndex: number
): Promise<StreamChunkRow[]> {
  const result = await pool.query(
    `SELECT chunk_index, chunk_type, chunk_data, created_at
     FROM public.ai_stream_chunks
     WHERE thread_id = $1 AND user_id = $2 AND chunk_index >= $3
     ORDER BY chunk_index ASC`,
    [threadId, userId, fromIndex]
  );
  return result.rows;
}

export async function getLatestChunkIndex(
  threadId: string,
  userId: string
): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(MAX(chunk_index), -1) AS max_index
     FROM public.ai_stream_chunks
     WHERE thread_id = $1 AND user_id = $2`,
    [threadId, userId]
  );
  return result.rows[0]?.max_index ?? -1;
}

// ─── Chunk serialiser ─────────────────────────────────────────────────────────
// Converts an AI SDK stream part into a storable { type, data } pair.

export function serialiseChunk(part: any): { type: string; data: any } | null {
  if (!part || !part.type) return null;

  switch (part.type) {
    case "text-delta":
      return { type: "text-delta", data: { textDelta: part.textDelta } };

    case "data-agent-activity":
      return { type: "data-agent-activity", data: part.data };

    case "finish":
      return {
        type: "finish",
        data: {
          finishReason: part.finishReason,
          usage: part.usage,
        },
      };

    case "reasoning":
      return { type: "reasoning", data: { reasoning: part.reasoning } };

    case "tool-call":
    case "tool-result":
      // Don't persist sensitive tool internals, just the activity label
      return null;

    default:
      // Persist unknown types as-is (defensive)
      return { type: part.type, data: part };
  }
}

// ─── SSE formatter ────────────────────────────────────────────────────────────
// Converts persisted chunks back into the AI SDK UI Message Stream Protocol
// so the frontend can replay them identically to a live stream.

export function chunksToSSE(chunks: StreamChunkRow[]): string {
  return chunks
    .map((row) => {
      const payload = JSON.stringify({
        type: row.chunk_type,
        ...(row.chunk_data as object),
      });
      return `data: ${payload}\n\n`;
    })
    .join("");
}
