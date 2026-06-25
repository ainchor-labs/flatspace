/**
 * File-type categorization for Flatdrive: maps a file's mime/name to a preview
 * kind, an icon, and human-readable size. Keeping this in one place lets the
 * dashboard, file rows, and preview all agree on how a file is treated.
 */

import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileText,
  FileType2,
  FileVideo,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "docx" | "none";

const CODE_EXT = new Set([
  "js", "jsx", "ts", "tsx", "json", "css", "scss", "html", "xml", "yaml", "yml", "toml",
  "md", "markdown", "py", "rb", "go", "rs", "java", "c", "h", "cpp", "cc", "cs", "php",
  "sh", "bash", "zsh", "fish", "sql", "swift", "kt", "lua", "ini", "conf", "env", "txt", "log", "csv",
]);

const ARCHIVE_EXT = new Set(["zip", "tar", "gz", "tgz", "rar", "7z", "bz2", "xz"]);

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function previewKind(mime: string, name: string): PreviewKind {
  const e = ext(name);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || e === "pdf") return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    e === "docx"
  ) {
    return "docx";
  }
  if (mime.startsWith("text/") || mime === "application/json" || CODE_EXT.has(e)) return "text";
  return "none";
}

/** Highlight.js language hint from a filename, or "" to let it auto-detect. */
export function codeLanguage(name: string): string {
  const e = ext(name);
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", rs: "rust", kt: "kotlin", sh: "bash", zsh: "bash", fish: "bash",
    md: "markdown", markdown: "markdown", yml: "yaml", "h": "cpp", cc: "cpp", cpp: "cpp",
  };
  return map[e] ?? (CODE_EXT.has(e) ? e : "");
}

export function iconFor(mime: string, name: string): LucideIcon {
  const kind = previewKind(mime, name);
  switch (kind) {
    case "image":
      return ImageIcon;
    case "video":
      return FileVideo;
    case "audio":
      return FileAudio;
    case "pdf":
      return FileText;
    case "docx":
      return FileType2;
    case "text":
      return FileCode;
    default:
      return ARCHIVE_EXT.has(ext(name)) ? FileArchive : FileIcon;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
