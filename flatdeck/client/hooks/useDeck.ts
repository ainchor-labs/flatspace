/**
 * Loads a single deck and provides debounced autosave — the Flatdeck counterpart
 * of Flatfile's useDocument. Coalesces rapid edits (~700ms) and patches
 * title/content through the shared api client.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Document } from "@flatspace/shared/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DeckPatch {
  title?: string;
  content?: string;
}

const AUTOSAVE_MS = 700;

export function useDeck(id: number) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DeckPatch>({});

  const query = useQuery({
    queryKey: ["flatdeck", "deck", id],
    queryFn: () => api.get<Document>(`/flatdeck/decks/${id}`),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (patch: DeckPatch) => api.patch<Document>(`/flatdeck/decks/${id}`, patch),
    onSuccess: (deck) => {
      setStatus("saved");
      qc.setQueryData(["flatdeck", "deck", id], deck);
      qc.invalidateQueries({ queryKey: ["flatdeck", "decks"] });
    },
    onError: () => setStatus("error"),
  });
  const mutate = mutation.mutate;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    mutate(patch);
  }, [mutate]);

  const save = useCallback(
    (patch: DeckPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => () => flush(), [flush]);

  return {
    deck: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    status,
    save,
    flush,
  };
}
