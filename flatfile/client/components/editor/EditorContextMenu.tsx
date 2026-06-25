/**
 * Editor context menu — shown on right-click anywhere in the document.
 *
 * Always offers clipboard (cut/copy/paste) + text formatting; when the click is
 * inside a table it also offers row/column insert + delete and delete-table.
 *
 * `onMouseDown` is prevented on the menu so the editor keeps focus + selection,
 * which lets execCommand copy/cut and the formatting commands act on the live
 * selection.
 */

import { useEffect, useRef, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  ClipboardPaste,
  Code,
  Copy,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Scissors,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@flatspace/shared/lib";
import { copySelection, cutSelection } from "./clipboard.ts";

export interface MenuAnchor {
  x: number;
  y: number;
}

function Item({
  icon,
  children,
  onClick,
  active,
  destructive,
  disabled,
  shortcut,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition hover:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground",
        active && "text-primary [&_svg]:text-primary",
        destructive && "text-destructive [&_svg]:text-destructive hover:bg-destructive/10",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {icon}
      <span className="flex-1 text-left">{children}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  );
}

function Sep() {
  return <div className="my-1 h-px bg-border" />;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{children}</div>;
}

export function EditorContextMenu({
  editor,
  anchor,
  inTable,
  onClose,
  onPaste,
}: {
  editor: Editor;
  anchor: MenuAnchor;
  inTable: boolean;
  onClose: () => void;
  onPaste: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const chain = () => editor.chain().focus();
  const hasSelection = !editor.state.selection.empty;

  // Cut/Copy use a from-scratch clipboard writer that works over plain HTTP.
  const copy = () => copySelection(editor);
  const cut = () => cutSelection(editor);
  // Paste opens a capture dialog so it works on HTTP (no async clipboard read).
  const paste = onPaste;
  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Link URL", prev);
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Keep the menu on-screen.
  const estHeight = inTable ? 470 : 320;
  const left = Math.min(anchor.x, window.innerWidth - 230);
  const top = Math.max(8, Math.min(anchor.y, window.innerHeight - estHeight));

  return (
    <div
      ref={ref}
      role="menu"
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: "fixed", left, top, zIndex: 130 }}
      className="min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl animate-scale-in"
    >
      <Item icon={<Scissors />} shortcut="Ctrl+X" disabled={!hasSelection} onClick={close(cut)}>
        Cut
      </Item>
      <Item icon={<Copy />} shortcut="Ctrl+C" disabled={!hasSelection} onClick={close(copy)}>
        Copy
      </Item>
      <Item icon={<ClipboardPaste />} shortcut="Ctrl+V" onClick={close(paste)}>
        Paste
      </Item>

      <Sep />

      <Item
        icon={<Bold />}
        shortcut="Ctrl+B"
        active={editor.isActive("bold")}
        onClick={close(() => chain().toggleBold().run())}
      >
        Bold
      </Item>
      <Item
        icon={<Italic />}
        shortcut="Ctrl+I"
        active={editor.isActive("italic")}
        onClick={close(() => chain().toggleItalic().run())}
      >
        Italic
      </Item>
      <Item
        icon={<UnderlineIcon />}
        shortcut="Ctrl+U"
        active={editor.isActive("underline")}
        onClick={close(() => chain().toggleUnderline().run())}
      >
        Underline
      </Item>
      <Item
        icon={<Strikethrough />}
        active={editor.isActive("strike")}
        onClick={close(() => chain().toggleStrike().run())}
      >
        Strikethrough
      </Item>
      <Item
        icon={<Code />}
        active={editor.isActive("code")}
        onClick={close(() => chain().toggleCode().run())}
      >
        Inline code
      </Item>
      <Item
        icon={<Highlighter />}
        active={editor.isActive("highlight")}
        onClick={close(() => chain().toggleHighlight().run())}
      >
        Highlight
      </Item>
      <Item icon={<LinkIcon />} shortcut="Ctrl+K" active={editor.isActive("link")} onClick={close(setLink)}>
        Link
      </Item>

      {inTable && (
        <>
          <Sep />
          <Label>Table</Label>
          <Item icon={<ArrowUpToLine />} onClick={close(() => chain().addRowBefore().run())}>
            Insert row above
          </Item>
          <Item icon={<ArrowDownToLine />} onClick={close(() => chain().addRowAfter().run())}>
            Insert row below
          </Item>
          <Item icon={<ArrowLeftToLine />} onClick={close(() => chain().addColumnBefore().run())}>
            Insert column left
          </Item>
          <Item icon={<ArrowRightToLine />} onClick={close(() => chain().addColumnAfter().run())}>
            Insert column right
          </Item>
          <Item icon={<Trash2 />} destructive onClick={close(() => chain().deleteRow().run())}>
            Delete row
          </Item>
          <Item icon={<Trash2 />} destructive onClick={close(() => chain().deleteColumn().run())}>
            Delete column
          </Item>
          <Item icon={<Trash2 />} destructive onClick={close(() => chain().deleteTable().run())}>
            Delete table
          </Item>
        </>
      )}
    </div>
  );
}
