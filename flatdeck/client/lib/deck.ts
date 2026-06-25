/**
 * Deck model + markdown rendering for Flatdeck.
 *
 * A deck's content column holds JSON: { version, theme, slides:[{ id, markdown }] }.
 * Each slide is plain markdown. Its first non-empty line may be a layout directive
 * — "@title", "@section", "@center" (or "@default") — which selects how the slide
 * is composed. Everything after the directive is the slide body, rendered with
 * markdown-it. This keeps the layout "at the start of each slide", editable as text.
 */

import MarkdownIt from "markdown-it";

export type SlideLayout = "default" | "title" | "section" | "center";
export type DeckTheme = "dark" | "light" | "indigo";
export type DeckTransition = "none" | "fade" | "slide";

export interface Slide {
  id: number;
  markdown: string;
  /** Speaker notes — shown in presenter mode, never on the slide itself. */
  notes?: string;
}

export interface DeckContent {
  version: number;
  theme: DeckTheme;
  transition: DeckTransition;
  slides: Slide[];
}

export const LAYOUTS: { id: SlideLayout; label: string; hint: string }[] = [
  { id: "default", label: "Default", hint: "Content from the top-left" },
  { id: "title", label: "Title", hint: "Large, centered title slide" },
  { id: "section", label: "Section", hint: "Section divider with accent" },
  { id: "center", label: "Centered", hint: "Everything centered" },
];

export const THEMES: { id: DeckTheme; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "indigo", label: "Indigo" },
];

export const TRANSITIONS: { id: DeckTransition; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide" },
];

const LAYOUT_IDS = new Set<string>(LAYOUTS.map((l) => l.id));
const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));
const TRANSITION_IDS = new Set<string>(TRANSITIONS.map((t) => t.id));

export function emptyDeck(): DeckContent {
  return { version: 1, theme: "dark", transition: "none", slides: [{ id: 1, markdown: "" }] };
}

/** Tolerantly parse stored deck JSON, migrating the legacy `elements` shape. */
export function parseDeck(raw: string): DeckContent {
  if (!raw || !raw.trimStart().startsWith("{")) return emptyDeck();
  try {
    const obj = JSON.parse(raw) as Partial<DeckContent> & {
      slides?: Array<{ id?: number; markdown?: string; notes?: unknown; elements?: unknown }>;
    };
    const theme = (obj.theme && THEME_IDS.has(obj.theme) ? obj.theme : "dark") as DeckTheme;
    const transition = (
      obj.transition && TRANSITION_IDS.has(obj.transition) ? obj.transition : "none"
    ) as DeckTransition;
    const slides: Slide[] = Array.isArray(obj.slides)
      ? obj.slides.map((s, i) => ({
          id: typeof s.id === "number" ? s.id : i + 1,
          markdown: typeof s.markdown === "string" ? s.markdown : "",
          notes: typeof s.notes === "string" ? s.notes : undefined,
        }))
      : [];
    return { version: 1, theme, transition, slides: slides.length ? slides : emptyDeck().slides };
  } catch {
    return emptyDeck();
  }
}

export function serializeDeck(deck: DeckContent): string {
  return JSON.stringify(deck);
}

/** The next free slide id (monotonic; ids are never reused). */
export function nextSlideId(slides: Slide[]): number {
  return slides.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

/** Split a slide's markdown into its layout directive and the body. */
export function parseSlide(markdown: string): { layout: SlideLayout; body: string } {
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
  const tag = lines[i]?.match(/^@([a-zA-Z][a-zA-Z-]*)\s*$/)?.[1]?.toLowerCase();
  if (tag && LAYOUT_IDS.has(tag)) {
    return { layout: tag as SlideLayout, body: lines.slice(i + 1).join("\n") };
  }
  return { layout: "default", body: markdown };
}

/** Rewrite a slide's markdown to use the given layout (directive on line 1). */
export function setSlideLayout(markdown: string, layout: SlideLayout): string {
  const { body } = parseSlide(markdown);
  return layout === "default" ? body.replace(/^\n+/, "") : `@${layout}\n${body.replace(/^\n+/, "")}`;
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true });

/** Render a slide's body (directive stripped) to HTML. */
export function renderSlideHtml(markdown: string): string {
  const { body } = parseSlide(markdown);
  return md.render(body);
}
