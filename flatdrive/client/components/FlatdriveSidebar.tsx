/**
 * Flatdrive sidebar — minimal, Drive-style: an Upload action, "My Drive" home,
 * and quick links to the root-level folders.
 */

import { HardDrive, Upload } from "lucide-react";
import { Button, SidebarItem, SidebarSection } from "@flatspace/shared/ui";
import { useBrowse } from "../hooks/useFlatdrive.ts";

export function FlatdriveSidebar({
  folderId,
  onOpenFolder,
  onUpload,
}: {
  folderId: number | null;
  onOpenFolder: (id: number | null) => void;
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
          icon={<HardDrive />}
          label="My Drive"
          active={folderId === null}
          onClick={() => onOpenFolder(null)}
        />
      </SidebarSection>

      {folders.length > 0 && (
        <SidebarSection title="Folders">
          {folders.map((f) => (
            <SidebarItem
              key={f.id}
              icon={<HardDrive />}
              label={f.name}
              active={folderId === f.id}
              onClick={() => onOpenFolder(f.id)}
            />
          ))}
        </SidebarSection>
      )}
    </div>
  );
}
