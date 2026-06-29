/**
 * Server-side spell checking for the Flatfile editor.
 *
 * The Hunspell English dictionary is loaded once (lazily) into an nspell
 * instance and shared across requests. The editor sends the distinct words it's
 * displaying; we return the ones the base dictionary doesn't recognise. The
 * caller subtracts the user's personal dictionary on top of this.
 *
 * Kept on the server so the ~hundreds-of-KB dictionary never ships to the
 * browser bundle (and dictionary-en is a Node-only, fs-backed module anyway).
 */

import nspell from "nspell";
import enDictionary from "dictionary-en";

let speller: ReturnType<typeof nspell> | null = null;

function getSpeller(): ReturnType<typeof nspell> {
  if (!speller) {
    speller = nspell({
      aff: Buffer.from(enDictionary.aff),
      dic: Buffer.from(enDictionary.dic),
    });
  }
  return speller;
}

// Only check word-like tokens: letters, optionally with internal apostrophes or
// hyphens. Skips numbers, code, URLs fragments, punctuation, etc.
const WORDISH = /^[A-Za-z][A-Za-z'’-]*$/;

/**
 * Of the supplied words, the ones the base English dictionary flags as
 * misspelled. Words are matched case-insensitively against the dictionary, and
 * a word is accepted if either its original or lowercased form is known (so
 * sentence-case and ALL-CAPS spellings aren't falsely flagged).
 */
export function baseMisspelled(words: string[]): string[] {
  const sp = getSpeller();
  const out: string[] = [];
  for (const w of words) {
    if (!WORDISH.test(w)) continue;
    if (sp.correct(w) || sp.correct(w.toLowerCase())) continue;
    out.push(w);
  }
  return out;
}

const ALPHA = "abcdefghijklmnopqrstuvwxyz";

/** All strings one edit (delete/transpose/substitute/insert) away from `word`. */
function edits1(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i <= w.length; i++) {
    if (i < w.length) out.add(w.slice(0, i) + w.slice(i + 1)); // deletion
    if (i < w.length - 1) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // transposition
    for (const c of ALPHA) {
      if (i < w.length) out.add(w.slice(0, i) + c + w.slice(i + 1)); // substitution
      out.add(w.slice(0, i) + c + w.slice(i)); // insertion
    }
  }
  out.delete(w);
  return [...out];
}

/** Up to `limit` correction suggestions for a (presumably misspelled) word. */
export function suggestions(word: string, limit = 8): string[] {
  if (!WORDISH.test(word)) return [];
  const sp = getSpeller();
  // Real dictionary words one edit away — high-quality, ordered closest first
  // (same-length transpositions/substitutions before insert/delete). Catches
  // common typos like "teh" → "the" that nspell's own suggester misses.
  const close = edits1(word)
    .filter((c) => sp.correct(c))
    .sort((a, b) => Math.abs(a.length - word.length) - Math.abs(b.length - word.length));
  // Then nspell's broader suggestions as a fallback.
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const s of [...close, ...sp.suggest(word)]) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(s);
    }
  }
  // Preserve the input's leading case ("Teh" → "The", not "the").
  const capitalised = word[0] === word[0]?.toUpperCase();
  const cased = capitalised ? merged.map((s) => s.charAt(0).toUpperCase() + s.slice(1)) : merged;
  return cased.slice(0, limit);
}
