/**
 * Export preview — a clean white "paper" rendering of the document (light theme,
 * honoring the document's margin + default font/size), with Print / Save-as-PDF
 * via the browser print dialog. This is a real, offline export path; Pandoc DOCX
 * and raw-markdown export arrive with the export milestone.
 */

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Printer, X } from "lucide-react";
import type { DocumentSettings } from "@flatspace/shared/types";
import { Button } from "@flatspace/shared/ui";
import { DEFAULT_FONT, DEFAULT_SIZE, marginById } from "./formatting.ts";

export function ExportPreview({
  editor,
  title,
  settings,
  onClose,
}: {
  editor: Editor;
  title: string;
  settings: DocumentSettings;
  onClose: () => void;
}) {
  // Snapshot the HTML once when the preview opens.
  const [html] = useState(() => editor.getHTML());
  const margin = marginById(settings.margin);
  const fontFamily = settings.fontFamily ?? DEFAULT_FONT;
  const fontSize = settings.fontSize ?? DEFAULT_SIZE;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex h-14 shrink-0 items-center justify-between px-4 print:hidden">
        <span className="truncate text-sm text-zinc-200">
          Export preview — <span className="font-medium">{title}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()}>
            <Printer /> Print / Save PDF
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-zinc-200 hover:text-white">
            <X /> Close
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8 print:overflow-visible print:p-0">
        <div
          className="ff-print-root ff-paper light mx-auto rounded-md shadow-2xl"
          style={{
            width: margin.maxWidth === "100%" ? "100%" : "210mm",
            maxWidth: "100%",
          }}
        >
          <div
            className="ff-prose"
            style={{
              fontFamily,
              fontSize,
              padding: `3rem ${margin.padX}`,
              maxWidth: margin.maxWidth,
              margin: "0 auto",
            }}
          >
            <h1 style={{ marginTop: 0 }}>{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>
    </div>
  );
}
