/**
 * Lightweight dropdown menu (no external dependency).
 *
 * Used for the user avatar menu, app switcher, and right-click context menus.
 * Handles outside-click + Escape to close. Intentionally small — the suite
 * favours minimal, context-aware chrome over heavy menu frameworks.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn.ts";

interface MenuCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const Ctx = createContext<MenuCtx | null>(null);

function useMenu(): MenuCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Menu components must be used within <Menu>");
  return ctx;
}

export function Menu({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      <div ref={ref} className={cn("relative", className)}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function MenuTrigger({ children }: { children: ReactNode }) {
  const { open, setOpen } = useMenu();
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(!open);
        }
      }}
    >
      {children}
    </div>
  );
}

export function MenuContent({
  children,
  align = "end",
  className,
}: {
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const { open } = useMenu();
  if (!open) return null;
  return (
    <div
      role="menu"
      className={cn(
        "absolute z-50 mt-2 min-w-48 origin-top overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-scale-in",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  destructive,
  icon,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  icon?: ReactNode;
}) {
  const { setOpen } = useMenu();
  const handle = useCallback(() => {
    onSelect?.();
    setOpen(false);
  }, [onSelect, setOpen]);
  return (
    <button
      role="menuitem"
      onClick={handle}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition hover:bg-accent focus:bg-accent focus:outline-none [&_svg]:size-4 [&_svg]:text-muted-foreground",
        destructive && "text-destructive [&_svg]:text-destructive hover:bg-destructive/10",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}
