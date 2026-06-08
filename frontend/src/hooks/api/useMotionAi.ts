import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface StreamOptions {
  action: string;
  text?: string;
  prompt?: string;
  context?: string;
  tone?: string;
  language?: string;
}

export function useMotionAi(orgId: string | null, spaceId: string | null, pageId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stream = useCallback(async (
    options: StreamOptions,
    onChunk: (text: string) => void,
    onComplete?: () => void
  ) => {
    if (!orgId || !spaceId || !pageId) {
      setError("Missing workspace context");
      return;
    }

    setIsStreaming(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/$/, "");
      const url = `${apiUrl}/v1/orgs/${orgId}/spaces/${spaceId}/notes/${pageId}/ai`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `AI request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              onChunk(parsed.text);
            }
          } catch (e: any) {
            console.error("Error parsing SSE line:", e);
            throw new Error(e.message || "Failed to process AI response");
          }
        }
      }

      onComplete?.();
    } catch (err: any) {
      console.error("Streaming error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsStreaming(false);
    }
  }, [orgId, spaceId, pageId]);

  return { stream, isStreaming, error };
}
