/**
 * Floating bubble toolbar shown on text selection (Typora/Google-Docs style).
 * Bold · Italic · Underline · Strikethrough · Inline code · Link · Highlight,
 * then heading levels H1–H4. Minimal + context-aware per the suite's design rules.
 */

import { BubbleMenu, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@flatspace/shared/lib";
import {
  FontFamilyControl,
  FontSizeControl,
  HighlightColorControl,
  TextColorControl,
} from "./FormatControls.tsx";

function Btn({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition [&_svg]:size-4",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function MarkBtn({
  editor,
  mark,
  icon: Icon,
  label,
}: {
  editor: Editor;
  mark: "bold" | "italic" | "underline" | "strike" | "code" | "highlight";
  icon: LucideIcon;
  label: string;
}) {
  const run = () => {
    const c = editor.chain().focus();
    ({
      bold: () => c.toggleBold().run(),
      italic: () => c.toggleItalic().run(),
      underline: () => c.toggleUnderline().run(),
      strike: () => c.toggleStrike().run(),
      code: () => c.toggleCode().run(),
      highlight: () => c.toggleHighlight().run(),
    })[mark]();
  };
  return (
    <Btn onClick={run} active={editor.isActive(mark)} label={label}>
      <Icon />
    </Btn>
  );
}

export function BubbleToolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Link URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, maxWidth: "none" }}
      shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive("codeBlock")}
      className="flex max-w-[min(94vw,760px)] flex-wrap items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-2xl"
    >
      <FontFamilyControl editor={editor} />
      <FontSizeControl editor={editor} />

      <div className="mx-1 h-5 w-px bg-border" />

      <MarkBtn editor={editor} mark="bold" icon={Bold} label="Bold" />
      <MarkBtn editor={editor} mark="italic" icon={Italic} label="Italic" />
      <MarkBtn editor={editor} mark="underline" icon={UnderlineIcon} label="Underline" />
      <MarkBtn editor={editor} mark="strike" icon={Strikethrough} label="Strikethrough" />
      <MarkBtn editor={editor} mark="code" icon={Code} label="Inline code" />
      <Btn onClick={setLink} active={editor.isActive("link")} label="Link">
        <LinkIcon />
      </Btn>

      <div className="mx-1 h-5 w-px bg-border" />

      <TextColorControl editor={editor} />
      <HighlightColorControl editor={editor} />

      <div className="mx-1 h-5 w-px bg-border" />

      {([1, 2, 3, 4] as const).map((level) => (
        <Btn
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          active={editor.isActive("heading", { level })}
          label={`Heading ${level}`}
        >
          <span className="text-xs font-semibold">H{level}</span>
        </Btn>
      ))}
    </BubbleMenu>
  );
}
