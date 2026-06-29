/**
 * Spellcheck — wavy-underline misspelled words in the editor.
 *
 * Words are checked in batches by the server (which owns the dictionary and the
 * user's personal word list); results are cached per word so typing only ever
 * asks about words it hasn't seen. Misspellings are drawn with ProseMirror
 * decorations (class `ff-misspelled`); right-click offers "Add to dictionary",
 * which persists the word server-side and clears it everywhere.
 *
 * Replaces the browser's native red squiggles (which can't take a custom
 * ignore-list), so the editor disables native spellcheck when this is active.
 */

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { api } from "@flatspace/shared/lib";

export const spellcheckKey = new PluginKey<DecorationSet>("spellcheck");

// A "word" for checking: letters with optional internal apostrophes/hyphens.
const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;

// Per-session verdict cache, keyed by the exact (case-sensitive) word.
// true = misspelled, false = ok. Shared across documents in this tab.
const verdict = new Map<string, boolean>();
const inflight = new Set<string>();

function wordsInDoc(doc: PMNode): string[] {
  const set = new Set<string>();
  doc.descendants((node) => {
    if (node.isText && node.text) for (const m of node.text.matchAll(WORD_RE)) set.add(m[0]);
    return true;
  });
  return [...set];
}

function buildDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (const m of node.text.matchAll(WORD_RE)) {
        if (verdict.get(m[0]) === true) {
          const from = pos + (m.index ?? 0);
          decos.push(Decoration.inline(from, from + m[0].length, { class: "ff-misspelled" }));
        }
      }
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}

/** The misspelled word covering `pos`, or null. Used by the context menu. */
export function misspelledWordAt(editor: Editor, pos: number): { from: number; to: number; word: string } | null {
  const set = spellcheckKey.getState(editor.state);
  if (!set) return null;
  const found = set.find(pos, pos);
  if (!found.length) return null;
  const { from, to } = found[0]!;
  return { from, to, word: editor.state.doc.textBetween(from, to) };
}

/** Fetch correction suggestions for a misspelled word. */
export async function suggestFor(word: string): Promise<string[]> {
  try {
    const res = await api.post<{ suggestions: string[] }>("/flatfile/spellcheck/suggest", { word });
    return res.suggestions ?? [];
  } catch {
    return [];
  }
}

/** Replace the text in [from, to) with `replacement` and place the caret after it. */
export function replaceWord(editor: Editor, from: number, to: number, replacement: string): void {
  editor.chain().focus().insertContentAt({ from, to }, replacement).run();
}

/** Persist a word to the user's dictionary and stop flagging it anywhere. */
export async function ignoreWord(editor: Editor, word: string): Promise<void> {
  try {
    await api.post("/flatfile/dictionary", { word });
  } catch {
    // Best-effort; still clear locally so the UI responds.
  }
  const lower = word.toLowerCase();
  for (const k of verdict.keys()) if (k.toLowerCase() === lower) verdict.set(k, false);
  editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, "recompute"));
}

export const Spellcheck = Extension.create({
  name: "spellcheck",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: spellcheckKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            if (tr.getMeta(spellcheckKey) === "recompute") return buildDecorations(tr.doc);
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state: EditorState) {
            return spellcheckKey.getState(state);
          },
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let first = true;

          const check = async () => {
            const todo = wordsInDoc(view.state.doc).filter((w) => !verdict.has(w) && !inflight.has(w));
            let changed = false;
            if (todo.length) {
              todo.forEach((w) => inflight.add(w));
              try {
                const res = await api.post<{ misspelled: string[] }>("/flatfile/spellcheck", { words: todo });
                const bad = new Set(res.misspelled ?? []);
                for (const w of todo) verdict.set(w, bad.has(w));
                changed = true;
              } catch {
                /* leave uncached so a later edit retries */
              } finally {
                todo.forEach((w) => inflight.delete(w));
              }
            }
            // Recompute on the first pass (to paint cached verdicts) or whenever
            // fresh verdicts arrived. Edits with no new words rely on position
            // mapping in `apply`, so they don't need a recompute.
            if (changed || first) {
              first = false;
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(spellcheckKey, "recompute"));
            }
          };

          const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(check, 400);
          };

          schedule();
          return {
            update: schedule,
            destroy: () => clearTimeout(timer),
          };
        },
      }),
    ];
  },
});
