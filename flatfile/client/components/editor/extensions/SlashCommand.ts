/**
 * SlashCommand extension — drives the "/" insert menu.
 *
 * Uses @tiptap/suggestion for matching and ReactRenderer to mount the React
 * menu, positioned with a fixed popup anchored to the caret rect (no tippy
 * dependency, fully offline).
 */

import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SlashCommandMenu, type SlashMenuRef } from "../SlashCommandMenu.tsx";
import { filterSlashItems, type SlashItem } from "./slash-items.ts";

type MenuProps = { items: SlashItem[]; command: (item: SlashItem) => void };

function createRenderer() {
  let component: ReactRenderer<SlashMenuRef, MenuProps> | null = null;
  let popup: HTMLDivElement | null = null;

  const place = (rect: SuggestionProps["clientRect"]) => {
    if (!popup || !rect) return;
    const r = rect();
    if (!r) return;
    popup.style.left = `${r.left}px`;
    popup.style.top = `${r.bottom + 6}px`;
  };

  const destroy = () => {
    popup?.remove();
    component?.destroy();
    popup = null;
    component = null;
  };

  return {
    onStart: (props: SuggestionProps<SlashItem>) => {
      component = new ReactRenderer(SlashCommandMenu, {
        props: { items: props.items, command: props.command },
        editor: props.editor,
      });
      popup = document.createElement("div");
      popup.style.position = "fixed";
      popup.style.zIndex = "120";
      popup.appendChild(component.element);
      document.body.appendChild(popup);
      place(props.clientRect);
    },
    onUpdate: (props: SuggestionProps<SlashItem>) => {
      component?.updateProps({ items: props.items, command: props.command });
      place(props.clientRect);
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        destroy();
        return true;
      }
      return component?.ref?.onKeyDown(props) ?? false;
    },
    onExit: destroy,
  };
}

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => filterSlashItems(query),
        render: createRenderer,
      }),
    ];
  },
});
