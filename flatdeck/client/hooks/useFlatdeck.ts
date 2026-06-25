/**
 * Flatdeck data hooks (TanStack Query). All requests go through the shared api client.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Document, DocumentSummary } from "@flatspace/shared/types";

export const flatdeckKeys = {
  decks: ["flatdeck", "decks"] as const,
};

export function useDecks() {
  return useQuery({
    queryKey: flatdeckKeys.decks,
    queryFn: () => api.get<DocumentSummary[]>("/flatdeck/decks"),
  });
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string }) => api.post<Document>("/flatdeck/decks", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.decks }),
  });
}

export function useRenameDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      api.patch<Document>(`/flatdeck/decks/${id}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.decks }),
  });
}

export function useDuplicateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/flatdeck/decks/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.decks }),
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatdeck/decks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdeckKeys.decks }),
  });
}
