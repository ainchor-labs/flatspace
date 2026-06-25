/**
 * Flatfile data hooks (TanStack Query) — the only way the Flatfile client talks
 * to the server. All requests go through the shared api client.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Document, DocumentSummary, Folder } from "@flatspace/shared/types";

export const flatfileKeys = {
  docs: (scope: string) => ["flatfile", "docs", scope] as const,
  recent: ["flatfile", "docs", "recent"] as const,
  folders: ["flatfile", "folders"] as const,
  search: (q: string) => ["flatfile", "search", q] as const,
};

export function useRecentDocuments() {
  return useQuery({
    queryKey: flatfileKeys.recent,
    queryFn: () => api.get<DocumentSummary[]>("/flatfile/docs/recent"),
  });
}

/** Search the user's documents by title + content. Disabled for empty queries. */
export function useSearchDocuments(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: flatfileKeys.search(term),
    queryFn: () => api.get<DocumentSummary[]>(`/flatfile/search?q=${encodeURIComponent(term)}`),
    enabled: term.length > 0,
  });
}

export function useDocuments(opts: { starred?: boolean; folderId?: number | null } = {}) {
  const params = new URLSearchParams();
  if (opts.starred) params.set("starred", "true");
  if (opts.folderId !== undefined) params.set("folderId", String(opts.folderId));
  const qs = params.toString();
  const scope = qs || "all";
  return useQuery({
    queryKey: flatfileKeys.docs(scope),
    queryFn: () => api.get<DocumentSummary[]>(`/flatfile/docs${qs ? `?${qs}` : ""}`),
  });
}

export function useFolders() {
  return useQuery({
    queryKey: flatfileKeys.folders,
    queryFn: () => api.get<Folder[]>("/flatfile/folders"),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; folderId?: number | null }) =>
      api.post<Document>("/flatfile/docs", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<{ id: number; starred: boolean }>(`/flatfile/docs/${id}/star`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile", "docs"] }),
  });
}

export function useRenameDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      api.patch<Document>(`/flatfile/docs/${id}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}

export function useDuplicateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Document>(`/flatfile/docs/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatfile/docs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}

export function useMoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: number; folderId: number | null }) =>
      api.patch<Document>(`/flatfile/docs/${id}`, { folderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<Folder>("/flatfile/folders", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatfileKeys.folders }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<Folder>(`/flatfile/folders/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatfile/folders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flatfile"] }),
  });
}
