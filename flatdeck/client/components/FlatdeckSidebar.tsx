/**
 * Flatdeck sidebar — the presentation-browser navigation that fills the shared
 * sidebar slot. A "New presentation" action plus the primary views
 * (Recent / All / Starred), mirroring Flatfile.
 */

import { Clock, Plus, Presentation, Star } from "lucide-react";
import { Button, SidebarItem, SidebarSection } from "@flatspace/shared/ui";
import type { FlatdeckView } from "../hooks/useFlatdeck.ts";

export function FlatdeckSidebar({
  view,
  onSelect,
  onNewDeck,
}: {
  view: FlatdeckView;
  onSelect: (view: FlatdeckView) => void;
  onNewDeck: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button className="w-full justify-start" onClick={onNewDeck}>
          <Plus /> New presentation
        </Button>
      </div>

      <SidebarSection>
        <SidebarItem
          icon={<Clock />}
          label="Recent"
          active={view === "recent"}
          onClick={() => onSelect("recent")}
        />
        <SidebarItem
          icon={<Presentation />}
          label="All presentations"
          active={view === "all"}
          onClick={() => onSelect("all")}
        />
        <SidebarItem
          icon={<Star />}
          label="Starred"
          active={view === "starred"}
          onClick={() => onSelect("starred")}
        />
      </SidebarSection>
    </div>
  );
}
