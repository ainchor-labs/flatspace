/**
 * Flatthoughts triage route (/flatthoughts/triage) — screen 4.
 * The Tinder-style swipe deck; closing returns to the wall of thoughts.
 */

import { useNavigate } from "react-router-dom";
import { TriageMode } from "@flatspace/flatthoughts/editor";

export function ThoughtTriagePage() {
  const navigate = useNavigate();
  return <TriageMode onClose={() => navigate("/flatthoughts")} />;
}
