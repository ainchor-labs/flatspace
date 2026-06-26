/**
 * Flatdeck data hooks (TanStack Query). All requests go through the shared api client.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Document, DocumentSummary } from "@flatspace/shared/types";

/** The primary deck views, shared between the sidebar and the dashboard. */
export type FlatdeckView = "recent" | "all" | "starred";

export const flatdeckKeys = {
  all: ["flatdeck"] as const,
  decks: ["flatdeck", "decks"] as const,
  recent: ["flatdeck", "recent"] as const,
  starred: ["flatdeck", "starred"] as const,
};

export function useDecks() {
  return useQuery({
    queryKey: flatdeckKeys.decks,
    queryFn: () => api.get<DocumentSummary[]>("/flatdeck/decks"),
  });
}

export function useRecentDecks() {
  return useQuery({
    queryKey: flatdeckKeys.recent,
    queryFn: () => api.get<DocumentSummary[]>("/flatdeck/decks/recent"),
  });
}

export function useStarredDecks() {
  return useQuery({
    queryKey: flatdeckKeys.starred,
    queryFn: () => api.get<DocumentSummary[]>("/flatdeck/decks?starred=true"),
  });
}

/** Pick the query for the active view, so the dashboard stays declarative. */
export function useDeckList(view: FlatdeckView) {
  const recent = useRecentDecks();
  const starred = useStarredDecks();
  const all = useDecks();
  return view === "recent" ? recent : view === "starred" ? starred : all;
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string }) => api.post<Document>("/flatdeck/decks", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.all }),
  });
}

export function useRenameDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      api.patch<Document>(`/flatdeck/decks/${id}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.all }),
  });
}

export function useDuplicateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/flatdeck/decks/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.all }),
  });
}

export function useToggleStarDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<{ id: number; starred: boolean }>(`/flatdeck/decks/${id}/star`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.all }),
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatdeck/decks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.all }),
  });
}
