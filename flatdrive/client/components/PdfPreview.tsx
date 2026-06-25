/**
 * PdfPreview — renders a PDF with pdf.js into stacked <canvas> pages.
 *
 * We deliberately don't use a native <iframe>/<embed>: those delegate to the
 * browser's PDF handler, which silently *downloads* the file when the user has
 * "Download PDFs instead of opening them" enabled. Rendering the pages ourselves
 * makes preview work regardless of that setting. Lazy-loaded so the (heavy)
 * pdf.js bundle is only fetched when a PDF is actually opened.
 */

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Download } from "lucide-react";
import { Button } from "@flatspace/shared/ui";
import { fileRawUrl } from "../hooks/useFlatdrive.ts";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const RENDER_SCALE = 1.5; // crisp without being enormous; canvases still scale down to fit

export function PdfPreview({ id, name }: { id: number; name: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    const task = pdfjs.getDocument({ url: fileRawUrl(id), withCredentials: true });

    (async () => {
      try {
        const doc = await task.promise;
        if (cancelled || !host) return;
        host.replaceChildren();
        const dpr = window.devicePixelRatio || 1;
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          canvas.className = "mx-auto mb-4 h-auto max-w-full rounded shadow-lg";
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          host.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      void task.destroy();
      host?.replaceChildren();
    };
  }, [id]);

  if (status === "error") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn’t render this PDF.</p>
        <a href={fileRawUrl(id, true)} download={name}>
          <Button>
            <Download /> Download
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/30 p-4">
      {status === "loading" && (
        <p className="mb-3 text-center text-sm text-muted-foreground">Loading PDF…</p>
      )}
      <div ref={hostRef} />
    </div>
  );
}
