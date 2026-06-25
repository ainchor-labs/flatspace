/**
 * Flatspace wordmark + glyph. The glyph is a minimal indigo "stacked planes"
 * mark rendered inline (no external asset — the suite bundles everything).
 */

import { cn } from "../lib/cn.ts";

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-primary"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 2 22 7l-10 5L2 7l10-5Z"
          fill="currentColor"
          fillOpacity="0.9"
        />
        <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.55" />
      </svg>
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">Flatspace</span>
      )}
    </div>
  );
}
