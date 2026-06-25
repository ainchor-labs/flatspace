/**
 * User avatar — colored initial badge. Color comes from the user's avatarColor
 * (also used for live cursors in collaborative editing).
 */

import { cn } from "../lib/cn.ts";

const SIZES = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/10",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials}
    </span>
  );
}
