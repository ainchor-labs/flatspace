/**
 * Slash-command catalogue: the insertable blocks offered by the "/" menu.
 * Each item runs a TipTap chain that first deletes the typed "/query" range.
 */

import type { Editor, Range } from "@tiptap/core";
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";

/** DOM event the Table command fires to open the size picker in the editor chrome. */
export const TABLE_PICKER_EVENT = "flatfile:table-picker";
export interface TablePickerDetail {
  left: number;
  top: number;
}

export interface SlashItem {
  title: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  command: (ctx: { editor: Editor; range: Range }) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    keywords: ["h1", "title", "heading"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    keywords: ["h2", "subtitle", "heading"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    keywords: ["h3", "heading"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "An unordered list",
    icon: List,
    keywords: ["bullet", "unordered", "ul", "list"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "An ordered list",
    icon: ListOrdered,
    keywords: ["ordered", "ol", "number", "list"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    description: "Track tasks with checkboxes",
    icon: CheckSquare,
    keywords: ["todo", "task", "checkbox", "check"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Capture a quotation",
    icon: Quote,
    keywords: ["quote", "blockquote", "citation"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Syntax-highlighted code",
    icon: Code2,
    keywords: ["code", "snippet", "pre"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Callout",
    description: "Highlight an aside",
    icon: Lightbulb,
    keywords: ["callout", "note", "info", "aside"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCallout({ variant: "info" }).run(),
  },
  {
    title: "Table",
    description: "Pick rows × columns",
    icon: TableIcon,
    keywords: ["table", "grid", "rows", "columns"],
    command: ({ editor, range }) => {
      // Remove the "/table" text, then ask the editor chrome to open the size
      // picker anchored at the caret (handled in DocumentEditor).
      editor.chain().focus().deleteRange(range).run();
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      editor.view.dom.dispatchEvent(
        new CustomEvent<TablePickerDetail>(TABLE_PICKER_EVENT, {
          detail: { left: coords.left, top: coords.bottom + 6 },
        }),
      );
    },
  },
  {
    title: "Image",
    description: "Embed an image by URL",
    icon: ImageIcon,
    keywords: ["image", "picture", "photo", "img"],
    command: ({ editor, range }) => {
      const url = window.prompt("Image URL");
      const chain = editor.chain().focus().deleteRange(range);
      if (url) chain.setImage({ src: url }).run();
      else chain.run();
    },
  },
  {
    title: "Divider",
    description: "A horizontal rule",
    icon: Minus,
    keywords: ["divider", "hr", "rule", "separator"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q)),
  );
}
