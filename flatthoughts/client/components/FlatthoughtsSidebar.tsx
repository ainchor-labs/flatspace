/**
 * Flatthoughts sidebar — fills the shared sidebar slot. Thoughts have no folders
 * or starring, so this is intentionally minimal: a "New thought" action, the wall
 * of notes, and a shortcut into triage (swipe) mode.
 */

import { Layers, Plus, StickyNote } from "lucide-react";
import { Button, SidebarItem, SidebarSection } from "@flatspace/shared/ui";

export function FlatthoughtsSidebar({
  onNew,
  onTriage,
}: {
  onNew: () => void;
  onTriage: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button className="w-full justify-start" onClick={onNew}>
          <Plus /> New thought
        </Button>
      </div>

      <SidebarSection>
        <SidebarItem icon={<StickyNote />} label="All thoughts" active />
        <SidebarItem icon={<Layers />} label="Triage" onClick={onTriage} />
      </SidebarSection>
    </div>
  );
}
