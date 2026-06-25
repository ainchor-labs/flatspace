/**
 * Global search results (/search?q=) — spans Flatfile documents and Flatdrive
 * files. Reached by pressing Enter in the top-bar search box.
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, HardDrive, Search } from "lucide-react";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import { useSearchDocuments } from "@flatspace/flatfile/client";
import { useSearchFiles } from "@flatspace/flatdrive/client";
import { useShell } from "../hooks/useShell.ts";

export function SearchResultsPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";

  const docs = useSearchDocuments(q);
  const files = useSearchFiles(q);

  const docResults = docs.data ?? [];
  const fileResults = files.data ?? [];
  const loading = docs.isLoading || files.isLoading;
  const total = docResults.length + fileResults.length;

  return (
    <AppShell {...shell}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Results for “{q}”
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Searching…" : `${total} result${total === 1 ? "" : "s"}`}
        </p>

        {!loading && total === 0 && (
          <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Search className="mb-3 size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No documents or files match “{q}”.</p>
          </div>
        )}

        {docResults.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Documents
            </h2>
            <div className="overflow-hidden rounded-xl border border-border">
              {docResults.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/flatfile/doc/${d.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent [&_svg]:size-4 [&_svg]:text-primary/70 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <FileText />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {fileResults.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Files
            </h2>
            <div className="overflow-hidden rounded-xl border border-border">
              {fileResults.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => navigate(`/flatdrive/file/${f.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <HardDrive />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{f.mime}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
