/**
 * DeckEditor — the Flatdeck slide editor surface.
 *
 * Left: a thumbnail navigator. Center: a markdown textarea for the current slide.
 * Right: a live SlideView preview. The header carries the title, per-slide layout
 * picker, deck theme picker, image insert, present, and export. Each slide is
 * markdown with an optional "@layout" directive on its first line; edits autosave
 * (debounced) as serialized deck JSON.
 */

import "./flatdeck.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  FileDown,
  Image as ImageIcon,
  LayoutTemplate,
  Palette,
  Play,
  Tag as TagIcon,
} from "lucide-react";
import type { Document } from "@flatspace/shared/types";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, TagPicker } from "@flatspace/shared/ui";
import { useDeck, type SaveStatus } from "../hooks/useDeck.ts";
import {
  LAYOUTS,
  THEMES,
  TRANSITIONS,
  nextSlideId,
  parseDeck,
  parseSlide,
  serializeDeck,
  setSlideLayout,
  type DeckContent,
  type SlideLayout,
} from "../lib/deck.ts";
import { SlideNavigator } from "./SlideNavigator.tsx";
import { SlideView } from "./SlideView.tsx";
import { PresentMode } from "./PresentMode.tsx";
import { DeckExport } from "./DeckExport.tsx";

export function DeckEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const { deck, isLoading, isError, status, save } = useDeck(id);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading deck…
      </div>
    );
  }
  if (isError || !deck) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-muted-foreground">Couldn’t open this deck.</p>
        <button onClick={onBack} className="text-sm text-primary hover:underline">
          Back to Flatdeck
        </button>
      </div>
    );
  }

  return <DeckSurface key={deck.id} deck={deck} status={status} save={save} onBack={onBack} />;
}

function DeckSurface({
  deck,
  status,
  save,
  onBack,
}: {
  deck: Document;
  status: SaveStatus;
  save: (patch: { title?: string; content?: string }) => void;
  onBack: () => void;
}) {
  const [content, setContent] = useState<DeckContent>(() => parseDeck(deck.content));
  const [title, setTitle] = useState(deck.title);
  const [current, setCurrent] = useState(0);
  const [showPresent, setShowPresent] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const idx = Math.max(0, Math.min(current, content.slides.length - 1));
  const slide = content.slides[idx]!;
  const layout = useMemo(() => parseSlide(slide.markdown).layout, [slide.markdown]);

  // Reflect the deck title in the browser tab.
  useEffect(() => {
    const prev = document.title;
    document.title = `${title?.trim() || "Untitled deck"} — Flatspace`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  const persist = useCallback(
    (next: DeckContent) => {
      setContent(next);
      save({ content: serializeDeck(next) });
    },
    [save],
  );

  const updateSlideMarkdown = useCallback(
    (markdown: string) => {
      const slides = content.slides.map((s, i) => (i === idx ? { ...s, markdown } : s));
      persist({ ...content, slides });
    },
    [content, idx, persist],
  );

  const updateSlideNotes = useCallback(
    (notes: string) => {
      const slides = content.slides.map((s, i) => (i === idx ? { ...s, notes } : s));
      persist({ ...content, slides });
    },
    [content, idx, persist],
  );

  const setTransition = useCallback(
    (transition: DeckContent["transition"]) => persist({ ...content, transition }),
    [content, persist],
  );

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      save({ title: value });
    },
    [save],
  );

  const setTheme = useCallback(
    (theme: DeckContent["theme"]) => persist({ ...content, theme }),
    [content, persist],
  );

  const setLayout = useCallback(
    (next: SlideLayout) => updateSlideMarkdown(setSlideLayout(slide.markdown, next)),
    [slide.markdown, updateSlideMarkdown],
  );

  const addSlide = useCallback(() => {
    const slides = [...content.slides];
    slides.splice(idx + 1, 0, { id: nextSlideId(content.slides), markdown: "" });
    persist({ ...content, slides });
    setCurrent(idx + 1);
  }, [content, idx, persist]);

  const duplicateSlide = useCallback(
    (i: number) => {
      const source = content.slides[i];
      if (!source) return;
      const slides = [...content.slides];
      slides.splice(i + 1, 0, { id: nextSlideId(content.slides), markdown: source.markdown });
      persist({ ...content, slides });
      setCurrent(i + 1);
    },
    [content, persist],
  );

  const deleteSlide = useCallback(
    (i: number) => {
      if (content.slides.length === 1) return; // always keep one slide
      const slides = content.slides.filter((_, j) => j !== i);
      persist({ ...content, slides });
      setCurrent((c) => Math.max(0, Math.min(c, slides.length - 1) - (i < c ? 1 : 0)));
    },
    [content, persist],
  );

  const moveSlide = useCallback(
    (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= content.slides.length) return;
      const slides = [...content.slides];
      const a = slides[i];
      const b = slides[j];
      if (!a || !b) return;
      slides[i] = b;
      slides[j] = a;
      persist({ ...content, slides });
      setCurrent(j);
    },
    [content, persist],
  );

  const insertAtCaret = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      const md = slide.markdown;
      if (!ta) {
        updateSlideMarkdown(md + text);
        return;
      }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      updateSlideMarkdown(md.slice(0, start) + text + md.slice(end));
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + text.length;
      });
    },
    [slide.markdown, updateSlideMarkdown],
  );

  const onPickImage = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") insertAtCaret(`\n![${file.name}](${reader.result})\n`);
      };
      reader.readAsDataURL(file);
    },
    [insertAtCaret],
  );

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
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled deck"
          className="min-w-0 flex-1 truncate bg-transparent px-1 text-sm font-medium outline-none placeholder:text-muted-foreground"
        />

        <span className="mr-1 text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : ""}
        </span>

        {/* Layout picker (current slide) */}
        <Menu>
          <MenuTrigger>
            <span className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
              <LayoutTemplate /> {LAYOUTS.find((l) => l.id === layout)?.label ?? "Layout"}
            </span>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Slide layout</MenuLabel>
            {LAYOUTS.map((l) => (
              <MenuItem key={l.id} onSelect={() => setLayout(l.id)}>
                {l.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        {/* Theme picker (deck) */}
        <Menu>
          <MenuTrigger>
            <span className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
              <Palette /> {THEMES.find((t) => t.id === content.theme)?.label ?? "Theme"}
            </span>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Deck theme</MenuLabel>
            {THEMES.map((t) => (
              <MenuItem key={t.id} onSelect={() => setTheme(t.id)}>
                {t.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        {/* Transition picker (deck) */}
        <Menu>
          <MenuTrigger>
            <span className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
              <ArrowLeftRight /> {TRANSITIONS.find((t) => t.id === content.transition)?.label ?? "None"}
            </span>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Slide transition</MenuLabel>
            {TRANSITIONS.map((t) => (
              <MenuItem key={t.id} onSelect={() => setTransition(t.id)}>
                {t.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        <TagPicker
          entityType="document"
          entityId={deck.id}
          current={deck.tags}
          align="end"
          trigger={
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
              <TagIcon /> {deck.tags.length > 0 ? deck.tags.length : "Tags"}
            </span>
          }
        />

        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Insert image"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <ImageIcon /> Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <button
          onClick={() => setShowPresent(true)}
          aria-label="Present"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <Play /> Present
        </button>

        <button
          onClick={() => setShowExport(true)}
          aria-label="Export deck"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <FileDown /> Export
        </button>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 border-r border-border bg-card/30">
          <SlideNavigator
            slides={content.slides}
            theme={content.theme}
            current={idx}
            onSelect={setCurrent}
            onAdd={addSlide}
            onDuplicate={duplicateSlide}
            onDelete={deleteSlide}
            onMove={moveSlide}
          />
        </aside>

        <main className="flex min-w-0 flex-1">
          <div className="flex w-1/2 flex-col border-r border-border">
            <textarea
              ref={textareaRef}
              value={slide.markdown}
              onChange={(e) => updateSlideMarkdown(e.target.value)}
              spellCheck
              placeholder={"@title\n# Slide title\n\n- point one\n- point two"}
              className="min-h-0 w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex h-40 shrink-0 flex-col border-t border-border bg-card/30">
              <div className="px-4 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Speaker notes
              </div>
              <textarea
                value={slide.notes ?? ""}
                onChange={(e) => updateSlideNotes(e.target.value)}
                spellCheck
                placeholder="Only you see these in presenter mode…"
                className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
          <div className="flex w-1/2 items-center justify-center bg-muted/20 p-6">
            <div className="w-full overflow-hidden rounded-lg shadow-2xl">
              <SlideView slide={slide} theme={content.theme} />
            </div>
          </div>
        </main>
      </div>

      {showPresent && (
        <PresentMode
          slides={content.slides}
          theme={content.theme}
          transition={content.transition}
          startIndex={idx}
          onClose={() => setShowPresent(false)}
        />
      )}
      {showExport && (
        <DeckExport
          slides={content.slides}
          theme={content.theme}
          title={title}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
