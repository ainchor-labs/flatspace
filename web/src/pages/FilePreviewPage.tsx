/**
 * Flatdrive file preview route (/flatdrive/file/:id).
 * Full-focus viewer — no dashboard chrome.
 */

import { useNavigate, useParams } from "react-router-dom";
import { FilePreview } from "@flatspace/flatdrive/client";

export function FilePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileId = Number(id);

  if (!Number.isFinite(fileId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Invalid file.
      </div>
    );
  }

  return <FilePreview id={fileId} onBack={() => navigate("/flatdrive")} />;
}
