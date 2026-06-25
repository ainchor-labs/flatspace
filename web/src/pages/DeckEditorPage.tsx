/**
 * Flatdeck slide editor route (/flatdeck/deck/:id).
 * Full-focus editor surface — no dashboard chrome.
 */

import { useNavigate, useParams } from "react-router-dom";
import { DeckEditor } from "@flatspace/flatdeck/editor";

export function DeckEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const deckId = Number(id);

  if (!Number.isFinite(deckId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Invalid deck.
      </div>
    );
  }

  return <DeckEditor id={deckId} onBack={() => navigate("/flatdeck")} />;
}
