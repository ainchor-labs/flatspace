/**
 * DocumentEditor — the Flatfile markdown editor surface.
 *
 * Composes the TipTap editor with the bubble toolbar, slash menu (via the
 * extension set), collapsible outline, find & replace (Ctrl+H / Ctrl+F), an
 * editable title, and the word-count/save status bar. Content is stored as
 * TipTap JSON; legacy markdown strings are parsed on load. Edits autosave.
 */

import "highlight.js/styles/github-dark.css";
import "./editor.css";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import {
  ArrowLeft,
  BookText,
  FileCode2,
  FileDown,
  FileText,
  FileType2,
  Hash,
  History,
  PanelLeft,
  Printer,
  Search,
  Tag as TagIcon,
  X,
} from "lucide-react";
import type { Document, DocumentSettings } from "@flatspace/shared/types";
import { cn } from "@flatspace/shared/lib";
import { MarkdownLineEditor, Menu, MenuContent, MenuItem, MenuTrigger, TagPicker } from "@flatspace/shared/ui";
import { renderDocMarkdown } from "../../lib/markdown.ts";
import { exportDocx, exportMarkdown, exportText } from "./export.ts";
import { VersionHistory } from "./VersionHistory.tsx";
import { MarkdownGuide } from "./MarkdownGuide.tsx";
import { useDocument, type DocumentPatch, type SaveStatus } from "../../hooks/useDocument.ts";
import { buildExtensions } from "./extensions/index.ts";
import { BubbleToolbar } from "./BubbleToolbar.tsx";
import { OutlinePanel } from "./OutlinePanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { FindReplace } from "./FindReplace.tsx";
import { TableSizePicker, type PickerAnchor } from "./TableSizePicker.tsx";
import { EditorContextMenu, type MenuAnchor } from "./EditorContextMenu.tsx";
import { DocFormatPopover } from "./DocFormatPopover.tsx";
import { ExportPreview } from "./ExportPreview.tsx";
import { PasteDialog } from "./PasteDialog.tsx";
import { DEFAULT_FONT, DEFAULT_SIZE, marginById } from "./formatting.ts";
import { TABLE_PICKER_EVENT, type TablePickerDetail } from "./extensions/slash-items.ts";

/** tiptap-markdown augments editor.storage but isn't in the core types. */
interface MarkdownStorage {
  markdown?: { getMarkdown(): string };
}

function parseContent(raw: string): JSONContent | string {
  if (!raw) return "";
  if (raw.trimStart().startsWith("{")) {
    try {
      return JSON.parse(raw) as JSONContent;
    } catch {
      return raw;
    }
  }
  return raw; // markdown string — parsed by the Markdown extension
}

export function DocumentEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const { document: doc, isLoading, isError, status, save } = useDocument(id);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading document…
      </div>
    );
  }
  if (isError || !doc) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-muted-foreground">Couldn’t open this document.</p>
        <button onClick={onBack} className="text-sm text-primary hover:underline">
          Back to Flatfile
        </button>
      </div>
    );
  }

  return <EditorSurface key={doc.id} doc={doc} status={status} save={save} onBack={onBack} />;
}

function EditorSurface({
  doc,
  status,
  save,
  onBack,
}: {
  doc: Document;
  status: SaveStatus;
  save: (patch: DocumentPatch) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [settings, setSettings] = useState<DocumentSettings>(doc.settings);
  // Outline starts open on desktop, collapsed on phones (where it would eat the
  // narrow content column).
  const [showOutline, setShowOutline] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768,
  );
  const [showFind, setShowFind] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [tableAnchor, setTableAnchor] = useState<PickerAnchor | null>(null);
  const [contextMenu, setContextMenu] = useState<(MenuAnchor & { inTable: boolean }) | null>(null);
  // Optional markdown mode: edit the raw markdown source (hybrid live preview)
  // instead of the rich TipTap surface. Round-trips through tiptap-markdown, so
  // rich-only constructs (tables, callouts, colors) are simplified on the way out.
  const [mdMode, setMdMode] = useState(false);
  const [mdText, setMdText] = useState("");

  // Reflect the document title in the browser tab.
  useEffect(() => {
    const prev = document.title;
    document.title = `${title?.trim() || "Untitled"} — Flatspace`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  const editor = useEditor({
    extensions: buildExtensions(),
    content: parseContent(doc.content),
    editorProps: {
      attributes: { class: "ff-prose", spellcheck: "true" },
    },
    onUpdate: ({ editor }) => save({ content: JSON.stringify(editor.getJSON()) }),
  });

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      save({ title: value });
    },
    [save],
  );

  const updateSettings = useCallback(
    (patch: DocumentSettings) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        save({ settings: next });
        return next;
      });
    },
    [save],
  );

  const enterMarkdownMode = useCallback(() => {
    if (!editor) return;
    const storage = editor.storage as MarkdownStorage;
    setMdText(storage.markdown?.getMarkdown() ?? editor.getText());
    setMdMode(true);
  }, [editor]);

  const exitMarkdownMode = useCallback(() => {
    // Parse the edited markdown back into the rich doc; this fires onUpdate,
    // which persists the canonical TipTap JSON via autosave.
    editor?.commands.setContent(parseContent(mdText));
    setMdMode(false);
  }, [editor, mdText]);

  const onMdChange = useCallback(
    (text: string) => {
      setMdText(text);
      save({ content: text }); // store raw markdown; re-parsed to JSON on exit
    },
    [save],
  );

  const handleExportDocx = useCallback(async () => {
    if (!editor) return;
    setExportMsg("Generating .docx…");
    try {
      await exportDocx(editor, title, doc.id);
      setExportMsg(null);
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "DOCX export failed");
    }
  }, [editor, title, doc.id]);

  // Auto-dismiss export errors (the "Generating…" message clears itself on done).
  useEffect(() => {
    if (!exportMsg || exportMsg.startsWith("Generating")) return;
    const t = setTimeout(() => setExportMsg(null), 5000);
    return () => clearTimeout(t);
  }, [exportMsg]);

  const margin = marginById(settings.margin);
  // Default font/size flow to .ff-prose via CSS variables; inline marks override.
  const surfaceStyle = {
    maxWidth: margin.maxWidth,
    padding: `3rem ${margin.padX}`,
    "--ff-font": settings.fontFamily ?? DEFAULT_FONT,
    "--ff-size": settings.fontSize ?? DEFAULT_SIZE,
  } as CSSProperties;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowFind(true);
      }
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowFind(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The slash "Table" command fires an event to open the size picker at the caret.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: Event) => {
      const { left, top } = (e as CustomEvent<TablePickerDetail>).detail;
      setTableAnchor({ left, top });
    };
    dom.addEventListener(TABLE_PICKER_EVENT, handler);
    return () => dom.removeEventListener(TABLE_PICKER_EVENT, handler);
  }, [editor]);

  // Right-click anywhere in the editor opens our context menu (and suppresses the
  // browser's native one). If nothing is selected we move the caret to the click
  // point so actions target it; an existing selection is preserved.
  const onContextMenu = (e: ReactMouseEvent) => {
    if (!editor) return;
    e.preventDefault();
    const inTable = !!(e.target as HTMLElement).closest("table");
    if (editor.state.selection.empty) {
      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (pos) editor.commands.setTextSelection(pos.pos);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, inTable });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top chrome */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
        >
          <ArrowLeft />
        </button>
        <button
          onClick={() => setShowOutline((v) => !v)}
          aria-label="Toggle outline"
          aria-pressed={showOutline}
          className={cn(
            "rounded-md p-2 transition hover:bg-accent [&_svg]:size-4",
            showOutline ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <PanelLeft />
        </button>

        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
          className="min-w-0 flex-1 truncate bg-transparent px-1 text-sm font-medium outline-none placeholder:text-muted-foreground"
        />

        <button
          onClick={() => setShowFind(true)}
          aria-label="Find and replace"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <Search /> <span className="hidden sm:inline">Find</span>
        </button>
        <button
          onClick={() => setShowHistory(true)}
          aria-label="Version history"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <History /> <span className="hidden sm:inline">History</span>
        </button>
        <button
          onClick={() => setShowGuide(true)}
          aria-label="Markdown reference"
          title="Markdown formatting reference"
          className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground sm:flex [&_svg]:size-3.5"
        >
          <BookText /> <span className="hidden sm:inline">Markdown</span>
        </button>
        <TagPicker
          entityType="document"
          entityId={doc.id}
          current={doc.tags}
          align="end"
          trigger={
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
              <TagIcon /> {doc.tags.length > 0 ? doc.tags.length : <span className="hidden sm:inline">Tags</span>}
            </span>
          }
        />
        <DocFormatPopover settings={settings} onChange={updateSettings} />
        <button
          onClick={() => (mdMode ? exitMarkdownMode() : enterMarkdownMode())}
          aria-label="Toggle markdown source mode"
          aria-pressed={mdMode}
          title="Edit raw markdown (line-by-line live preview)"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5",
            mdMode ? "bg-accent text-foreground" : "text-muted-foreground",
          )}
        >
          <FileCode2 /> <span className="hidden sm:inline">MD</span>
        </button>
        <Menu>
          <MenuTrigger>
            <span className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
              <FileDown /> <span className="hidden sm:inline">Export</span>
            </span>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<Printer />} onSelect={() => setShowExport(true)}>
              PDF (print)
            </MenuItem>
            <MenuItem icon={<FileType2 />} onSelect={handleExportDocx}>
              Word (.docx)
            </MenuItem>
            <MenuItem icon={<Hash />} onSelect={() => editor && exportMarkdown(editor, title)}>
              Markdown (.md)
            </MenuItem>
            <MenuItem icon={<FileText />} onSelect={() => editor && exportText(editor, title)}>
              Plain text (.txt)
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        <aside
          className={cn(
            "shrink-0 overflow-hidden border-r border-border bg-card/30 transition-[width] duration-200",
            showOutline ? "w-60" : "w-0",
          )}
        >
          <div className="h-full w-60">{editor && <OutlinePanel editor={editor} />}</div>
        </aside>

        <div
          className="relative min-w-0 flex-1 overflow-y-auto"
          onContextMenu={mdMode ? undefined : onContextMenu}
        >
          {editor && showFind && !mdMode && <FindReplace editor={editor} onClose={() => setShowFind(false)} />}
          {editor && !mdMode && <BubbleToolbar editor={editor} />}
          <div className="mx-auto" style={surfaceStyle}>
            {mdMode ? (
              <MarkdownLineEditor
                value={mdText}
                onChange={onMdChange}
                render={renderDocMarkdown}
                proseClassName="ff-prose"
                placeholder="Write markdown…"
                className="min-h-[60vh]"
              />
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
        </div>
      </div>

      {editor && tableAnchor && (
        <TableSizePicker
          anchor={tableAnchor}
          onSelect={(rows, cols) => {
            editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
            setTableAnchor(null);
          }}
          onClose={() => setTableAnchor(null)}
        />
      )}

      {editor && contextMenu && (
        <EditorContextMenu
          editor={editor}
          anchor={contextMenu}
          inTable={contextMenu.inTable}
          onClose={() => setContextMenu(null)}
          onPaste={() => setShowPaste(true)}
        />
      )}

      {editor && showPaste && (
        <PasteDialog editor={editor} onClose={() => setShowPaste(false)} />
      )}

      {editor && showExport && (
        <ExportPreview
          editor={editor}
          title={title}
          settings={settings}
          onClose={() => setShowExport(false)}
        />
      )}

      {showHistory && (
        <VersionHistory
          docId={doc.id}
          onClose={() => setShowHistory(false)}
          onRestored={(content) => editor?.commands.setContent(parseContent(content))}
        />
      )}

      {showGuide && <MarkdownGuide onClose={() => setShowGuide(false)} />}

      {exportMsg && (
        <div className="fixed bottom-4 right-4 z-[200] flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-xl">
          <span>{exportMsg}</span>
          <button
            onClick={() => setExportMsg(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
          >
            <X />
          </button>
        </div>
      )}

      {editor && <StatusBar editor={editor} status={status} />}
    </div>
  );
}
