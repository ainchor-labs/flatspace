/**
 * Promise-based confirm/prompt dialogs (no external dependency).
 *
 * Mounted once at the app root via <DialogProvider>. Components call
 * `const { confirm, prompt } = useDialog()` and `await confirm({...})` /
 * `await prompt({...})` — replacing blocking window.confirm()/window.prompt()
 * with styled, accessible modals.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "./button.tsx";
import { Input } from "./input.tsx";

interface ConfirmOpts {
  title?: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface PromptOpts extends ConfirmOpts {
  defaultValue?: string;
  placeholder?: string;
}

interface DialogCtx {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
}

const Ctx = createContext<DialogCtx | null>(null);

export function useDialog(): DialogCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDialog must be used within <DialogProvider>");
  return ctx;
}

type State =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void }
  | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setState({ kind: "confirm", opts, resolve })),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? "");
        setState({ kind: "prompt", opts, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (result: boolean | string | null) => {
      setState((s) => {
        if (s) (s.resolve as (v: boolean | string | null) => void)(result);
        return null;
      });
    },
    [],
  );

  // Focus the input (prompt) when a dialog opens; Escape cancels.
  useEffect(() => {
    if (!state) return;
    if (state.kind === "prompt") inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(state.kind === "confirm" ? false : null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, settle]);

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => settle(state.kind === "confirm" ? false : null)}
          />
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              settle(state.kind === "prompt" ? value : true);
            }}
            className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl animate-scale-in"
          >
            {state.opts.title && (
              <h2 className="text-base font-semibold tracking-tight">{state.opts.title}</h2>
            )}
            {state.opts.message && (
              <div className="mt-1.5 text-sm text-muted-foreground">{state.opts.message}</div>
            )}
            {state.kind === "prompt" && (
              <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={state.opts.placeholder}
                className="mt-3"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => settle(state.kind === "confirm" ? false : null)}
              >
                {state.opts.cancelText ?? "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                variant={state.opts.destructive ? "destructive" : "default"}
              >
                {state.opts.confirmText ?? "Confirm"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  );
}
