/**
 * Flatthoughts editor route (/flatthoughts/thought/:id) — screen 2.
 * Full-focus surface, no dashboard chrome.
 */

import { useNavigate, useParams } from "react-router-dom";
import { ThoughtEditor } from "@flatspace/flatthoughts/editor";

export function ThoughtEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const thoughtId = Number(id);

  if (!Number.isFinite(thoughtId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Invalid thought.
      </div>
    );
  }

  return <ThoughtEditor id={thoughtId} onBack={() => navigate("/flatthoughts")} />;
}
