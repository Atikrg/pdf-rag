import type { Citation } from "@/lib/api";

export type { Citation };

export type Message = {
  role: "user" | "ai";
  text: string;
  createdAt: string;
  citations?: Citation[];
};

export type CiteItem = {
  label: string;
  snippet: string;
};

export type DocRecord = {
  id: string;
  name: string;
  pages: number;
  chunks: number;
  status?: string;
};

export type Conversation = {
  id: string;
  title: string;
  meta: string;
  docId: string;
  messages: Message[];
  qcount: number;
  cites: CiteItem[];
};

export type TabId = "doc" | "cites" | "sum";

export type QuickPromptIcon = "sparkles" | "chartbar" | "alert" | "calendar";

export type QuickPrompt = {
  icon: QuickPromptIcon;
  label: string;
};