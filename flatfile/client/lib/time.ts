/**
 * Human-friendly relative time for "edited X ago" labels.
 * SQLite stores UTC datetimes ("YYYY-MM-DD HH:MM:SS"); normalise to ISO first.
 */

export function relativeTime(value: string): string {
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return value;

  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
