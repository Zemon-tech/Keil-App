import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SttProvider = "sarvam" | "elevenlabs";

export interface UserAppPreferences {
  user_id: string;
  stt_provider: SttProvider;
  created_at: string;
  updated_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches the current user's app preferences.
 * Query key: ["user-preferences"]
 */
export function usePreferences() {
  return useQuery<UserAppPreferences>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await api.get<{ data: UserAppPreferences }>("v1/preferences");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation to update the user's STT provider preference.
 */
export function useUpdateSttProvider() {
  const queryClient = useQueryClient();

  return useMutation<UserAppPreferences, Error, SttProvider>({
    mutationFn: async (provider: SttProvider) => {
      const res = await api.patch<{ data: UserAppPreferences }>(
        "v1/preferences/stt-provider",
        { provider }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user-preferences"], data);
    },
  });
}
