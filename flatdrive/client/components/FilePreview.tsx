/**
 * FilePreview — full-screen viewer that switches on file type.
 *
 *   image            <img>
 *   video / audio    native players (server supports Range, so seeking works)
 *   pdf              native <iframe> (browser PDF viewer)
 *   text / code      fetched + syntax-highlighted (highlight.js)
 *   docx             Pandoc-rendered HTML in a sandboxed <iframe srcDoc>
 *   anything else    metadata + download
 */

import "highlight.js/styles/github-dark.css";

import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import hljs from "highlight.js/lib/common";
import { ArrowLeft, Download } from "lucide-react";
import { api } from "@flatspace/shared/lib";
import { Button } from "@flatspace/shared/ui";
import { fileRawUrl, useFile } from "../hooks/useFlatdrive.ts";
import { codeLanguage, formatBytes, iconFor, previewKind } from "../lib/fileType.ts";

// pdf.js is heavy — only pull it into the bundle when a PDF is actually opened.
const PdfPreview = lazy(() =>
  import("./PdfPreview.tsx").then((m) => ({ default: m.PdfPreview })),
);

const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024; // don't inline-render text larger than 2 MB

export function FilePreview({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: file, isLoading, isError } = useFile(id);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (isError || !file) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-muted-foreground">Couldn’t open this file.</p>
        <button onClick={onBack} className="text-sm text-primary hover:underline">
          Back to Flatdrive
        </button>
      </div>
    );
  }

  const kind = previewKind(file.mime, file.name);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
        >
          <ArrowLeft />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
        <a href={fileRawUrl(file.id, true)} download={file.name}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Download /> Download
          </Button>
        </a>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <PreviewBody file={file} kind={kind} />
      </div>
    </div>
  );
}

function PreviewBody({
  file,
  kind,
}: {
  file: { id: number; name: string; mime: string; size: number };
  kind: ReturnType<typeof previewKind>;
}) {
  switch (kind) {
    case "image":
      return <ImagePreview file={file} />;
    case "video":
      return <VideoPreview file={file} />;
    case "audio":
      return <AudioPreview file={file} />;
    case "pdf":
      return (
        <Suspense fallback={<Notice>Loading PDF…</Notice>}>
          <PdfPreview id={file.id} name={file.name} />
        </Suspense>
      );
    case "text":
      return <TextPreview file={file} />;
    case "docx":
      return <DocxPreview id={file.id} />;
    default:
      return <Unsupported file={file} />;
  }
}

function TextPreview({ file }: { file: { id: number; name: string; size: number } }) {
  const tooBig = file.size > TEXT_PREVIEW_LIMIT;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["flatdrive", "text", file.id],
    enabled: !tooBig,
    queryFn: async () => {
      const res = await fetch(fileRawUrl(file.id), { credentials: "include" });
      return res.text();
    },
  });

  const highlighted = useMemo(() => {
    if (!data) return "";
    const lang = codeLanguage(file.name);
    try {
      return lang && hljs.getLanguage(lang)
        ? hljs.highlight(data, { language: lang }).value
        : hljs.highlightAuto(data).value;
    } catch {
      return null;
    }
  }, [data, file.name]);

  if (tooBig) return <Notice>File is large ({formatBytes(file.size)}). Download it to view.</Notice>;
  if (isLoading) return <Notice>Loading…</Notice>;
  if (isError || data == null) return <Notice>Couldn’t load text.</Notice>;

  return (
    <pre className="m-0 min-h-full overflow-auto p-4 text-sm leading-relaxed">
      {highlighted != null ? (
        <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
      ) : (
        <code>{data}</code>
      )}
    </pre>
  );
}

function DocxPreview({ id }: { id: number }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["flatdrive", "docx", id],
    queryFn: () => api.get<{ html: string }>(`/flatdrive/files/${id}/preview-docx`),
    retry: false,
  });

  if (isLoading) return <Notice>Rendering document…</Notice>;
  if (isError || !data) {
    const msg = error instanceof Error ? error.message : "Couldn’t render this document.";
    return <Notice>{msg}</Notice>;
  }
  // Sandboxed iframe isolates the converted document's styles from the app.
  return <iframe srcDoc={data.html} title="Document preview" sandbox="" className="h-full w-full border-0 bg-white" />;
}

type PreviewFile = { id: number; name: string; mime: string; size: number };

function ImagePreview({ file }: { file: PreviewFile }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Unsupported file={file} message="Couldn’t display this image in the browser." />;
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <img
        src={fileRawUrl(file.id)}
        alt={file.name}
        className="max-h-full max-w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function VideoPreview({ file }: { file: PreviewFile }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Unsupported file={file} message="Couldn’t play this video in the browser." />;
  return (
    <div className="flex min-h-full items-center justify-center bg-black p-6">
      <video
        src={fileRawUrl(file.id)}
        controls
        className="max-h-full max-w-full"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function AudioPreview({ file }: { file: PreviewFile }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Unsupported file={file} message="Couldn’t play this audio in the browser." />;
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <audio
        src={fileRawUrl(file.id)}
        controls
        className="w-full max-w-lg"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function Unsupported({ file, message }: { file: PreviewFile; message?: string }) {
  const Icon = iconFor(file.mime, file.name);
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon className="size-12 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {file.mime || "Unknown type"} · {formatBytes(file.size)}
        </p>
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">
        {message ?? "No inline preview for this file type."}
      </p>
      <a href={fileRawUrl(file.id, true)} download={file.name}>
        <Button>
          <Download /> Download
        </Button>
      </a>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6 text-sm text-muted-foreground">{children}</div>;
}
