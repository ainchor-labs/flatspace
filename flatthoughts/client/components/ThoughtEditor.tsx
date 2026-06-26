/**
 * ThoughtEditor (screen 2) — view & edit an existing thought. Loads the thought
 * and wires the shared ThoughtComposer to debounced autosave (useThought).
 */

import { useCallback, useState } from "react";
import type { Thought } from "@flatspace/shared/types";
import { useThought, type SaveStatus } from "../hooks/useThought.ts";
import { ThoughtComposer } from "./ThoughtComposer.tsx";

export function ThoughtEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const { thought, isLoading, isError, status, save } = useThought(id);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading thought…
      </div>
    );
  }
  if (isError || !thought) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-muted-foreground">Couldn’t open this thought.</p>
        <button onClick={onBack} className="text-sm text-primary hover:underline">
          Back to Flatthoughts
        </button>
      </div>
    );
  }

  return <EditorSurface key={thought.id} thought={thought} status={status} save={save} onBack={onBack} />;
}

function EditorSurface({
  thought,
  status,
  save,
  onBack,
}: {
  thought: Thought;
  status: SaveStatus;
  save: (patch: { title?: string; content?: string }) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(thought.title);
  const [content, setContent] = useState(thought.content);

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      save({ title: value });
    },
    [save],
  );
  const onContentChange = useCallback(
    (value: string) => {
      setContent(value);
      save({ content: value });
    },
    [save],
  );

  return (
    <ThoughtComposer
      title={title}
      content={content}
      status={status}
      onTitleChange={onTitleChange}
      onContentChange={onContentChange}
      onBack={onBack}
      backLabel="Back to Flatthoughts"
    />
  );
}
