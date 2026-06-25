/**
 * Loads a single Flatfile document and provides debounced autosave.
 *
 * Save status drives the "Saving…/Saved" indicator in the editor chrome.
 * Autosave coalesces rapid edits (≈700ms) and patches title/content through the
 * shared api client. Version snapshots (every 30s) arrive with the history milestone.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Document, DocumentSettings } from "@flatspace/shared/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DocumentPatch {
  title?: string;
  content?: string;
  settings?: DocumentSettings;
}

const AUTOSAVE_MS = 700;

export function useDocument(id: number) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DocumentPatch>({});

  const query = useQuery({
    queryKey: ["flatfile", "doc", id],
    queryFn: () => api.get<Document>(`/flatfile/docs/${id}`),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (patch: DocumentPatch) => api.patch<Document>(`/flatfile/docs/${id}`, patch),
    onSuccess: (doc) => {
      setStatus("saved");
      qc.setQueryData(["flatfile", "doc", id], doc);
      qc.invalidateQueries({ queryKey: ["flatfile", "docs"] });
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
    (patch: DocumentPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  // Flush any pending edits on unmount so nothing is lost when leaving the editor.
  useEffect(() => () => flush(), [flush]);

  return {
    document: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    status,
    save,
    flush,
  };
}
