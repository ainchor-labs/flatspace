/**
 * Flatdrive sidebar — Drive-style navigation that fills the shared sidebar slot.
 * An Upload action, the cross-folder views (Recent / Starred), the "FlatDrive"
 * root browser, and quick links to the root-level folders.
 */

import { Clock, HardDrive, Star, Upload } from "lucide-react";
import { Button, SidebarItem, SidebarSection } from "@flatspace/shared/ui";
import { useBrowse } from "../hooks/useFlatdrive.ts";

/** Either a flat cross-folder view, or browsing a folder (null = root). */
export type FlatdriveView = "recent" | "starred" | { folderId: number | null };

const isBrowse = (v: FlatdriveView): v is { folderId: number | null } => typeof v === "object";

export function FlatdriveSidebar({
  view,
  onSelect,
  onUpload,
}: {
  view: FlatdriveView;
  onSelect: (view: FlatdriveView) => void;
  onUpload: () => void;
}) {
  const root = useBrowse(null);
  const folders = root.data?.folders ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button className="w-full justify-start" onClick={onUpload}>
          <Upload /> Upload
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
          icon={<Star />}
          label="Starred"
          active={view === "starred"}
          onClick={() => onSelect("starred")}
        />
        <SidebarItem
          icon={<HardDrive />}
          label="FlatDrive"
          active={isBrowse(view) && view.folderId === null}
          onClick={() => onSelect({ folderId: null })}
        />
      </SidebarSection>

      {folders.length > 0 && (
        <SidebarSection title="Folders">
          {folders.map((f) => (
            <SidebarItem
              key={f.id}
              icon={<HardDrive />}
              label={f.name}
              active={isBrowse(view) && view.folderId === f.id}
              onClick={() => onSelect({ folderId: f.id })}
            />
          ))}
        </SidebarSection>
      )}
    </div>
  );
}
