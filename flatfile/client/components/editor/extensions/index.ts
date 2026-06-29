/**
 * Central TipTap extension set for the Flatfile editor.
 *
 * StarterKit (with its codeBlock disabled in favour of the syntax-highlighted
 * lowlight block) + the marks/nodes the suite spec calls for: underline, link,
 * highlight, task lists, tables, images, callouts. The Markdown extension powers
 * markdown input rules + the export path; SlashCommand drives the "/" menu.
 */

import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { FontSize } from "./FontSize.ts";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import type { Extensions } from "@tiptap/core";
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { Callout } from "./Callout.ts";
import { ListExit } from "./ListExit.ts";
import { Spellcheck } from "./Spellcheck.ts";
import { SlashCommand } from "./SlashCommand.ts";

const lowlight = createLowlight(common);

export function buildExtensions(): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    Highlight.configure({ multicolor: true }),
    // textStyle is the carrier mark for color, font family, and font size.
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: false, allowBase64: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    Callout,
    ListExit,
    Spellcheck,
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === "heading" ? "Heading" : "Type '/' for commands…",
      includeChildren: false,
    }),
    Markdown.configure({
      html: false,
      tightLists: true,
      linkify: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    SlashCommand,
  ];
}
