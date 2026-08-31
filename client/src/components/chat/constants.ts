import type { JobStatus } from "@/lib/api";
import type { QuickPrompt, TabId } from "./types";

export const POLL_INTERVAL_MS = 1500;

export const ACTIVE_ID_KEY = "documind.activeSessionId";
export const ACTIVE_DOC_KEY = "documind.activeDocId";

// Number of chats a guest (not-logged-in) user has used. Persisted locally so
// the "first chat is free" rule survives a page refresh on the same browser.
export const GUEST_CHAT_COUNT_KEY = "documind.guestChatCount";

export const MAX_TEXTAREA_HEIGHT = 88;

export const PROGRESS_LABEL: Record<JobStatus["state"], string> = {
  active: "Indexing your document…",
  waiting: "Queued…",
  delayed: "Delayed…",
  paused: "Paused",
  failed: "Processing failed",
  unknown: "Processing…",
  completed: "Completed",
};

export const QUICK_PROMPTS: QuickPrompt[] = [
  { icon: "sparkles", label: "Explain the key concepts" },
  { icon: "chartbar", label: "Summarize the document" },
  { icon: "alert", label: "Identify key risks" },
  { icon: "calendar", label: "Find key dates" },
];

export const RIGHT_PANEL_TABS: { id: TabId; label: string }[] = [
  { id: "doc", label: "Document" },
  { id: "cites", label: "Citations" },
  { id: "sum", label: "Summary" },
];