/**
 * Flatdrive data hooks (TanStack Query). All server access goes through the
 * shared api client. Folder navigation is keyed by folderId (null = root).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { DriveFolder, DriveListing, FileItem } from "@flatspace/shared/types";

export const flatdriveKeys = {
  browse: (folderId: number | null) => ["flatdrive", "browse", folderId] as const,
  all: ["flatdrive"] as const,
};

function browsePath(folderId: number | null): string {
  return folderId === null ? "/flatdrive/browse" : `/flatdrive/browse?folderId=${folderId}`;
}

export function useBrowse(folderId: number | null) {
  return useQuery({
    queryKey: flatdriveKeys.browse(folderId),
    queryFn: () => api.get<DriveListing>(browsePath(folderId)),
  });
}

export function useFile(id: number) {
  return useQuery({
    queryKey: ["flatdrive", "file", id],
    queryFn: () => api.get<FileItem>(`/flatdrive/files/${id}`),
  });
}

/** Flat list of the user's most recently updated files (across all folders). */
export function useRecentFiles(enabled = true) {
  return useQuery({
    queryKey: ["flatdrive", "recent"],
    queryFn: () => api.get<FileItem[]>("/flatdrive/recent"),
    enabled,
  });
}

/** Flat list of every file the user has starred. */
export function useStarredFiles(enabled = true) {
  return useQuery({
    queryKey: ["flatdrive", "starred"],
    queryFn: () => api.get<FileItem[]>("/flatdrive/all?starred=true"),
    enabled,
  });
}

export function useToggleStarFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.patch<{ id: number; starred: boolean }>(`/flatdrive/files/${id}/star`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

/** Search the user's files by name. Disabled for empty queries. */
export function useSearchFiles(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ["flatdrive", "search", term],
    queryFn: () => api.get<FileItem[]>(`/flatdrive/search?q=${encodeURIComponent(term)}`),
    enabled: term.length > 0,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; parentId: number | null }) =>
      api.post<DriveFolder>("/flatdrive/folders", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, folderId }: { file: File; folderId: number | null }) => {
      // Transport as octet-stream (so no built-in body parser consumes it) and
      // pass the real mime as a query param.
      const params = new URLSearchParams({ name: file.name, mime: file.type || "application/octet-stream" });
      if (folderId !== null) params.set("folderId", String(folderId));
      return api.upload<FileItem>(`/flatdrive/files?${params}`, file, "application/octet-stream");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useRenameFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<FileItem>(`/flatdrive/files/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatdrive/files/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useMoveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: number; folderId: number | null }) =>
      api.patch<FileItem>(`/flatdrive/files/${id}`, { folderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
      api.patch<DriveFolder>(`/flatdrive/folders/${id}`, { parentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<DriveFolder>(`/flatdrive/folders/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/flatdrive/folders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: flatdriveKeys.all }),
  });
}

/** Convenience: the URL that streams a file's bytes (for <img>/<video>/<iframe>/download). */
export function fileRawUrl(id: number, download = false): string {
  return `/api/flatdrive/files/${id}/raw${download ? "?download=1" : ""}`;
}
