/**
 * Loads a single thought with debounced autosave — the Flatthoughts counterpart
 * of Flatfile's useDocument / Flatdeck's useDeck. Coalesces rapid edits (~600ms)
 * and patches title/content through the shared api client.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Thought } from "@flatspace/shared/types";
import { flatthoughtsKeys } from "./useFlatthoughts.ts";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface ThoughtPatch {
  title?: string;
  content?: string;
}

const AUTOSAVE_MS = 600;

export function useThought(id: number) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ThoughtPatch>({});

  const query = useQuery({
    queryKey: ["flatthoughts", "thought", id],
    queryFn: () => api.get<Thought>(`/flatthoughts/thoughts/${id}`),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (patch: ThoughtPatch) => api.patch<Thought>(`/flatthoughts/thoughts/${id}`, patch),
    onSuccess: (thought) => {
      setStatus("saved");
      qc.setQueryData(["flatthoughts", "thought", id], thought);
      qc.invalidateQueries({ queryKey: flatthoughtsKeys.thoughts });
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
    (patch: ThoughtPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => () => flush(), [flush]);

  return {
    thought: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    status,
    save,
    flush,
  };
}
