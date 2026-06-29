/**
 * ListExit — press Enter on an empty list item to leave the list.
 *
 * TipTap's StarterKit splits the current item on Enter but never exits, so an
 * empty trailing item just spawns more empty items. This mirrors the familiar
 * Docs/Notion behaviour: the first Enter splits to a fresh (empty) item, and a
 * second Enter on that empty item lifts back out into a normal paragraph.
 *
 * Runs at high priority so it sees Enter before the list extensions; when the
 * cursor isn't in an empty list/task item it returns false and the default
 * split behaviour takes over.
 */

import { Extension } from "@tiptap/core";

export const ListExit = Extension.create({
  name: "listExit",
  priority: 1000,

  addKeyboardShortcuts() {
    const liftIfEmpty = (itemType: string): boolean => {
      const { selection } = this.editor.state;
      if (!selection.empty) return false;
      const { $from } = selection;
      // The item node wrapping the textblock the cursor sits in.
      const item = $from.node(-1);
      if (!item || item.type.name !== itemType) return false;
      // Only act when that textblock is empty (so a non-empty item still splits).
      if ($from.parent.content.size > 0) return false;
      return this.editor.commands.liftListItem(itemType);
    };

    return {
      Enter: () => liftIfEmpty("listItem") || liftIfEmpty("taskItem"),
    };
  },
});
