/**
 * NewThought (screen 3) — compose a brand-new thought. Starts blank and uses the
 * same autosave model as the rest of the suite: the thought is created lazily on
 * the first real keystroke, then patched (full snapshot, last-write-wins) on
 * every subsequent debounced tick. Leaving while still empty creates nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@flatspace/shared/lib";
import type { Thought } from "@flatspace/shared/types";
import type { SaveStatus } from "../hooks/useThought.ts";
import { flatthoughtsKeys } from "../hooks/useFlatthoughts.ts";
import { ThoughtComposer } from "./ThoughtComposer.tsx";

const AUTOSAVE_MS = 600;

export function NewThought({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Refs hold the freshest values so the debounced flush always sends a current
  // full snapshot (avoids lost updates while the initial create is in flight).
  const titleRef = useRef("");
  const contentRef = useRef("");
  const createdId = useRef<number | null>(null);
  const createInFlight = useRef<Promise<number> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async () => {
    const t = titleRef.current;
    const c = contentRef.current;
    // Don't materialise an empty note.
    if (createdId.current === null && !t.trim() && !c.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("saving");
    try {
      if (createdId.current === null) {
        if (!createInFlight.current) {
          createInFlight.current = api
            .post<Thought>("/flatthoughts/thoughts", { title: t, content: c })
            .then((th) => {
              createdId.current = th.id;
              return th.id;
            });
        }
        const id = await createInFlight.current;
        // Edits made during the create round-trip → flush them too.
        if (titleRef.current !== t || contentRef.current !== c) {
          await api.patch(`/flatthoughts/thoughts/${id}`, {
            title: titleRef.current,
            content: contentRef.current,
          });
        }
      } else {
        await api.patch(`/flatthoughts/thoughts/${createdId.current}`, { title: t, content: c });
      }
      setStatus("saved");
      qc.invalidateQueries({ queryKey: flatthoughtsKeys.thoughts });
    } catch {
      setStatus("error");
    }
  }, [qc]);

  const schedule = useCallback(() => {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      titleRef.current = value;
      schedule();
    },
    [schedule],
  );
  const onContentChange = useCallback(
    (value: string) => {
      setContent(value);
      contentRef.current = value;
      schedule();
    },
    [schedule],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Save any pending edits before leaving, then return to the list.
  const handleBack = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void persist().finally(onBack);
  }, [persist, onBack]);

  return (
    <ThoughtComposer
      title={title}
      content={content}
      status={status}
      onTitleChange={onTitleChange}
      onContentChange={onContentChange}
      onBack={handleBack}
      backLabel="Back to Flatthoughts"
      placeholder="What’s on your mind? Markdown supported — start typing to save."
    />
  );
}
