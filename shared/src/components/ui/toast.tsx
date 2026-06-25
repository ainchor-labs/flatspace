/**
 * Lightweight toast notifications (no external dependency).
 *
 * Mounted once at the app root via <ToastProvider>. Any component calls
 * `const { toast } = useToast()` and `toast({ message, variant })` to show a
 * transient, auto-dismissing notification — replacing blocking window.alert().
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/cn.ts";

export type ToastVariant = "default" | "success" | "error";

interface Toast {
  id: number;
  title?: string;
  message: string;
  variant: ToastVariant;
}

interface ToastInput {
  message: string;
  title?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastCtx {
  toast: (t: ToastInput) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// Monotonic id source (Date.now/Math.random are intentionally avoided suite-wide).
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ message, title, variant = "default", duration = 4000 }: ToastInput) => {
      const id = ++nextId;
      setToasts((list) => [...list, { id, message, title, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

const ICONS = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
} as const;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.variant];
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl animate-scale-in",
        toast.variant === "success" && "border-emerald-500/30",
        toast.variant === "error" && "border-destructive/40",
        toast.variant === "default" && "border-border",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          toast.variant === "success" && "text-emerald-500",
          toast.variant === "error" && "text-destructive",
          toast.variant === "default" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        {toast.title && <div className="text-sm font-medium">{toast.title}</div>}
        <div className="text-sm text-muted-foreground">{toast.message}</div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
