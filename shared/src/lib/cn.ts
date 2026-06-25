/**
 * `cn` — merge Tailwind class names with conflict resolution.
 * Standard shadcn/ui helper used by every component.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
