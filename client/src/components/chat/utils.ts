import type { IconName } from "./Icon";
import type { Citation } from "./types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toTitle(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function historyIcon(docName: string): IconName {
  const n = docName.toLowerCase();
  if (n.includes("contract") || n.includes("nda")) return "filetext";
  if (n.includes("research") || n.includes("paper") || n.includes("thesis")) return "microscope";
  if (n.includes("handbook") || n.includes("employee") || n.includes("policy")) return "users";
  if (n.includes("annual") || n.includes("report") || n.includes("financial") || n.includes("20")) return "chartbar";
  return "pdf";
}

export function citationLabel(citation: Citation): string | null {
  const page =
    citation.pageIndex != null
      ? `p. ${citation.pageIndex}`
      : null;
  const range =
    citation.lines != null &&
    citation.lines.from != null &&
    citation.lines.to != null
      ? `${citation.lines.from}–${citation.lines.to}`
      : null;
  const label = [page, range].filter(Boolean).join(" · ");
  return label || null;
}

export function buildCitationSnippet(citation: Citation, prompt: string): string {
  if (
    citation.lines != null &&
    citation.lines.from != null &&
    citation.lines.to != null
  ) {
    return `Lines ${citation.lines.from}–${citation.lines.to}`;
  }
  return prompt.length > 60 ? `${prompt.slice(0, 60)}…` : prompt;
}