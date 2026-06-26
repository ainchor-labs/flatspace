/**
 * Flatthoughts compose route (/flatthoughts/new) — screen 3.
 * Full-focus blank composer; autosaves (creates on first keystroke).
 */

import { useNavigate } from "react-router-dom";
import { NewThought } from "@flatspace/flatthoughts/editor";

export function NewThoughtPage() {
  const navigate = useNavigate();
  return <NewThought onBack={() => navigate("/flatthoughts")} />;
}
