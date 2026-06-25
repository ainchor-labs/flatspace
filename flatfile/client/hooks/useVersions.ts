/**
 * Version-history data hooks for a single Flatfile document.
 *
 * History is created server-side (throttled auto-snapshots on save); the client
 * just lists snapshots, fetches one on demand for preview, and restores. All
 * requests go through the shared api client.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Document, Version, VersionSummary } from "@flatspace/shared/types";

export const versionKeys = {
  list: (docId: number) => ["flatfile", "versions", docId] as const,
};

export function useVersions(docId: number, enabled = true) {
  return useQuery({
    queryKey: versionKeys.list(docId),
    queryFn: () => api.get<VersionSummary[]>(`/flatfile/docs/${docId}/versions`),
    enabled,
  });
}

/** Fetch a single snapshot's full content (lazily, for preview). */
export function fetchVersion(docId: number, versionId: number): Promise<Version> {
  return api.get<Version>(`/flatfile/docs/${docId}/versions/${versionId}`);
}

export function useRestoreVersion(docId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) =>
      api.post<Document>(`/flatfile/docs/${docId}/versions/${versionId}/restore`),
    onSuccess: (doc) => {
      qc.setQueryData(["flatfile", "doc", docId], doc);
      qc.invalidateQueries({ queryKey: versionKeys.list(docId) });
      qc.invalidateQueries({ queryKey: ["flatfile", "docs"] });
    },
  });
}
