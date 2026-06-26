/**
 * Flatthoughts data hooks (TanStack Query). All requests go through the shared
 * api client, mirroring useFlatdeck/useFlatfile.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Thought } from "@flatspace/shared/types";

export const flatthoughtsKeys = {
  all: ["flatthoughts"] as const,
  thoughts: ["flatthoughts", "thoughts"] as const,
  review: ["flatthoughts", "review"] as const,
};

export function useThoughts() {
  return useQuery({
    queryKey: flatthoughtsKeys.thoughts,
    queryFn: () => api.get<Thought[]>("/flatthoughts/thoughts"),
  });
}

/** The triage (swipe) deck — least-recently-reviewed first. */
export function useReviewQueue() {
  return useQuery({
    queryKey: flatthoughtsKeys.review,
    queryFn: () => api.get<Thought[]>("/flatthoughts/thoughts/review"),
    // Always fetch a fresh deck when entering triage.
    staleTime: 0,
    gcTime: 0,
  });
}

export function useSearchThoughts(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["flatthoughts", "search", q],
    queryFn: () => api.get<Thought[]>(`/flatthoughts/thoughts/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });
}

export function useCreateThought() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; content?: string }) =>
      api.post<Thought>("/flatthoughts/thoughts", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatthoughtsKeys.thoughts }),
  });
}

export function useDeleteThought() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatthoughts/thoughts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatthoughtsKeys.thoughts }),
  });
}

/** Mark a thought "kept" in triage (stamps reviewed_at). */
export function useReviewThought() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Thought>(`/flatthoughts/thoughts/${id}/review`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatthoughtsKeys.thoughts }),
  });
}
