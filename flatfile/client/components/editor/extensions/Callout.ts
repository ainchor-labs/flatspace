/**
 * Callout block node — a coloured, icon-led aside (info / success / warn / danger).
 *
 * Not part of CommonMark, so for the markdown export path (tiptap-markdown) it
 * serialises to a blockquote prefixed with an emoji marker; on re-import it would
 * read back as a blockquote. Since documents are stored as TipTap JSON, the rich
 * callout itself round-trips losslessly in normal editing.
 */

import { mergeAttributes, Node } from "@tiptap/core";

export type CalloutVariant = "info" | "success" | "warn" | "danger";

const MARKERS: Record<CalloutVariant, string> = {
  info: "💡",
  success: "✅",
  warn: "⚠️",
  danger: "🛑",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { variant: CalloutVariant }) => ReturnType;
      toggleCallout: (attrs?: { variant: CalloutVariant }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (el) => el.getAttribute("data-variant") ?? "info",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": "", class: "ff-callout" }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; wrapBlock: (a: string, b: null, node: unknown, fn: () => void) => void },
          node: { attrs: { variant: CalloutVariant } },
        ) {
          const marker = MARKERS[node.attrs.variant] ?? MARKERS.info;
          state.wrapBlock("> ", null, node, () => {
            state.write(`${marker} `);
            (state as unknown as { renderContent: (n: unknown) => void }).renderContent(node);
          });
        },
        parse: {},
      },
    };
  },
});
