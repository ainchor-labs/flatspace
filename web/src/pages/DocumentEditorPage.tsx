/**
 * Flatfile document editor route (/flatfile/doc/:id).
 * Full-focus editor surface — no dashboard chrome.
 */

import { useNavigate, useParams } from "react-router-dom";
import { DocumentEditor } from "@flatspace/flatfile/editor";

export function DocumentEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const docId = Number(id);

  if (!Number.isFinite(docId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Invalid document.
      </div>
    );
  }

  return <DocumentEditor id={docId} onBack={() => navigate("/flatfile")} />;
}
