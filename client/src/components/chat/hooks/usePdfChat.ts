"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  uploadPdf,
  getJobStatus,
  streamChat,
  listDocuments,
  listSessions,
  getSession,
  createSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getSummary,
  getToken,
  type JobStatus,
  type Citation,
  type DocumentRecord,
} from "@/lib/api";
import {
  POLL_INTERVAL_MS,
  PROGRESS_LABEL,
  ACTIVE_ID_KEY,
  ACTIVE_DOC_KEY,
  GUEST_CHAT_COUNT_KEY,
} from "../constants";
import { uid, toTitle, buildCitationSnippet } from "../utils";
import { useAuth } from "./useAuth";
import type { CiteItem, Conversation, DocRecord } from "../types";

export type UsePdfChatReturn = {
  docList: DocRecord[];
  conversations: Conversation[];
  activeId: string | null;
  activeConversation: Conversation | null;
  activeDocument: DocRecord | null;
  uploadingFile: File | null;
  uploading: boolean;
  sending: boolean;
  loadingHistory: boolean;
  error: string | null;
  input: string;
  percent: number;
  progressText: string;
  systemText: string;
  inputHint: string;
  summary: string | null;
  authenticated: boolean;
  user: import("@/lib/api").User | null;
  logout: () => void;
  setInput: (value: string) => void;
  setError: (value: string | null) => void;
  onFiles: (files: FileList | null) => void;
  selectConversation: (id: string) => void;
  openDocConversation: (record: DocRecord) => void;
  newChat: () => void;
  clearConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<boolean>;
  sendMessage: (promptOverride?: string) => void;
  refreshSummary: () => Promise<void>;
};

function toDocRecord(d: DocumentRecord): DocRecord {
  return {
    id: d.id,
    name: d.originalName,
    pages: d.totalPages ?? 0,
    chunks: d.totalChunks ?? 0,
    status: d.status,
  };
}

function citationsFromMessage(m: { citations?: Citation[] | null }): CiteItem[] {
  if (!m.citations) return [];
  const seen = new Set<string>();
  const items: CiteItem[] = [];
  for (const c of m.citations) {
    const key = c.pageIndex != null
      ? `Page ${c.pageIndex}`
      : c.sheetName != null
      ? `${c.sheetName}:${c.rowIndex}`
      : c.paragraphIndex != null
      ? `Para ${c.paragraphIndex}`
      : c.sectionIndex != null
      ? `Sec ${c.sectionIndex}`
      : null;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({ label: key, snippet: buildCitationSnippet(c, "") });
  }
  return items;
}

function getGuestChatCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(GUEST_CHAT_COUNT_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function incrementGuestChatCount(): number {
  const next = getGuestChatCount() + 1;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GUEST_CHAT_COUNT_KEY, String(next));
  }
  return next;
}

export function usePdfChat(): UsePdfChatReturn {
  const { authenticated, user, logout } = useAuth();

  const [docList, setDocList] = useState<DocRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_ID_KEY),
  );
  const [activeDocId, setActiveDocId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem(ACTIVE_DOC_KEY),
  );

  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<JobStatus | null>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<AbortController | null>(null);
  const promptRef = useRef<string>("");

  const loadDocsAndSessions = useCallback(async () => {
    if (!getToken()) return;
    try {
      const [docs, sessions] = await Promise.all([
        listDocuments(),
        listSessions(),
      ]);
      const readyDocs = docs
        .filter((d) => d.status === "ready")
        .map(toDocRecord);
      setDocList(readyDocs);

      const convs: Conversation[] = sessions.map((s) => ({
        id: s.id,
        title: s.title,
        meta: new Date(s.updatedAt).toLocaleDateString(),
        docId: s.documentId ?? "",
        messages: [],
        qcount: 0,
        cites: [],
      }));

      // `loadSession` runs concurrently on mount to restore the active
      // transcript, and the list endpoint deliberately returns no messages.
      // Whichever request lands last used to win, so a slow session list
      // silently wiped a transcript that had just been restored and the chat
      // came back empty after a refresh. Keep any transcript already in state.
      setConversations((prev) => {
        const loaded = new Map(prev.map((c) => [c.id, c]));
        return convs.map((c) => {
          const existing = loaded.get(c.id);
          if (!existing || existing.messages.length === 0) return c;
          return {
            ...c,
            messages: existing.messages,
            cites: existing.cites,
            qcount: existing.qcount,
          };
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your data");
    }
  }, []);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_ID_KEY, activeId);
    else localStorage.removeItem(ACTIVE_ID_KEY);
  }, [activeId]);

  useEffect(() => {
    if (activeDocId) localStorage.setItem(ACTIVE_DOC_KEY, activeDocId);
    else localStorage.removeItem(ACTIVE_DOC_KEY);
  }, [activeDocId]);

  const restoreRef = useRef(false);

  const loadSession = useCallback(
    async (sessionId: string) => {
      setLoadingHistory(true);
      try {
        setActiveId(sessionId);
        localStorage.setItem(ACTIVE_ID_KEY, sessionId);
        const session = await getSession(sessionId);
        const messages = session.messages.map((m) => ({
          role: (m.role === "user" ? "user" : "ai") as "user" | "ai",
          text: m.content,
          createdAt: m.createdAt,
          citations: m.citations ?? undefined,
        }));
        const cites = messages.flatMap((m) =>
          citationsFromMessage({ citations: m.citations }),
        );
        const qcount = messages.filter((m) => m.role === "user").length;
        const docId =
          session.documentId ??
          (session.document ? session.document.id : "") ??
          "";

        setConversations((prev) => {
          const existing = prev.find((c) => c.id === sessionId);
          const updated = {
            id: sessionId,
            title: session.title,
            docId,
            messages,
            cites,
            qcount,
            meta: new Date(session.updatedAt).toLocaleDateString(),
          };
          if (!existing) return [updated, ...prev];
          return prev.map((c) => (c.id === sessionId ? updated : c));
        });
        if (docId) setActiveDocId(docId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Load documents + sessions, and on refresh restore the previously active
    // session's messages directly from the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocsAndSessions();
    if (!restoreRef.current) {
      const persisted = localStorage.getItem(ACTIVE_ID_KEY);
      if (persisted) {
        restoreRef.current = true;
        void loadSession(persisted);
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      streamRef.current?.abort();
    };
  }, [loadDocsAndSessions, loadSession]);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      const conv = conversations.find((c) => c.id === id);
      if (conv && conv.messages.length === 0) {
        loadSession(id);
      }
    },
    [conversations, loadSession],
  );

  const startUpload = async (selected: File) => {
    if (pollRef.current) clearInterval(pollRef.current);

    setUploadingFile(selected);
    setError(null);
    setUploading(true);
    setStatus(null);

    try {
      const { jobId, documentId } = await uploadPdf(selected);

      const poll = async () => {
        try {
          const current = await getJobStatus(jobId);
          if (!current) return;
          setStatus(current);

          if (current.state === "completed" || current.state === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setUploading(false);

            if (current.state === "completed" && current.result) {
              const rec: DocRecord = {
                id: documentId,
                name: selected.name,
                pages: current.result.totalPages,
                chunks: current.result.totalChunks,
                status: "ready",
              };

              setDocList((prev) => [
                rec,
                ...prev.filter((d) => d.id !== rec.id),
              ]);
              setActiveDocId(rec.id);

              // Create a backend session bound to the freshly indexed document.
              const session = await createSession({ documentId: rec.id });
              const conv: Conversation = {
                id: session.id,
                title: session.title,
                meta: "Just now",
                docId: rec.id,
                messages: [],
                qcount: 0,
                cites: [],
              };
              setConversations((prev) => [conv, ...prev]);
              setActiveId(conv.id);

              // Mark this guest's used-up free chat (guests get one for free).
              if (!authenticated) incrementGuestChatCount();
            } else {
              setError("Document processing failed on the server.");
            }
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setUploading(false);
          setError(err instanceof Error ? err.message : "Processing failed");
        }
      };

      poll();
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const onFiles = (files: FileList | null) => {
    const selected = files?.[0];

    // A guest (not-logged-in) user gets the first chat free. From their second
    // chat onwards, prompt them to log in.
    if (selected && !authenticated && getGuestChatCount() >= 1) {
      setError("Please login first to upload PDFs.");
      return;
    }

    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/markdown",
      "text/plain",
    ];

    if (selected && allowedMimeTypes.includes(selected.type)) {
      startUpload(selected);
    } else if (selected) {
      setError("File type not supported. Please upload a PDF, Excel, CSV, Word, Markdown, or Text file.");
    }
  };

  const openDocConversation = (record: DocRecord) => {
    if (!record) return;
    (async () => {
      try {
        setLoadingHistory(true);
        const session = await createSession({ documentId: record.id });
        const conv: Conversation = {
          id: session.id,
          title: session.title,
          meta: "Just now",
          docId: record.id,
          messages: [],
          qcount: 0,
          cites: [],
        };
        setActiveDocId(record.id);
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start chat");
      } finally {
        setLoadingHistory(false);
      }
    })();
  };

  const newChat = () => {
    if (!activeDocId) return;
    openDocConversation({ id: activeDocId } as DocRecord);
  };

  const clearConversation = () => {
    if (!activeId) return;
    (async () => {
      try {
        await apiDeleteSession(activeId);
        setConversations((prev) => prev.filter((c) => c.id !== activeId));
        setActiveId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear chat");
      }
    })();
  };

  /**
   * Deletes any conversation in the Recent list, not just the active one. The
   * row is removed only after the server confirms, so a failed delete leaves
   * the sidebar honest instead of showing a session that still exists.
   */
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await apiDeleteSession(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // Deleting the open conversation drops back to no selection rather than
      // leaving the workspace pointing at a session that no longer exists.
      // Messages live inside `conversations`, so clearing `activeId` is what
      // empties the transcript; `activeConversation` is derived from it.
      setActiveId((prev) => (prev === id ? null : prev));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    }
  }, []);

  /**
   * Renames a conversation, applying the change optimistically and rolling back
   * to the previous title if the server rejects it, so the sidebar never keeps
   * a title that was not persisted.
   */
  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return false;

      const previous = conversations.find((c) => c.id === id)?.title ?? "";
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
      );

      try {
        const saved = await apiRenameSession(id, trimmed);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: saved } : c)),
        );
        return true;
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: previous } : c)),
        );
        setError(err instanceof Error ? err.message : "Failed to rename chat");
        return false;
      }
    },
    [conversations],
  );

  const sendMessage = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? input).trim();
    if (!activeDocId || !prompt || sending) return;

    const docId = activeDocId;
    promptRef.current = prompt;
    setInput("");
    setSending(true);
    setError(null);

    // A stable key that identifies this conversation across the optimistic
    // insert and the server-assigned session id.
    const convKey = activeId ?? uid();

    const updateConv = (
      key: string,
      fn: (c: Conversation) => Conversation,
    ) => {
      setConversations((prev) => {
        const target = prev.find((c) => c.id === key);
        if (target) {
          return prev.map((c) => (c.id === key ? fn(c) : c));
        }
        // A brand-new conversation (no server session yet).
        const conv = fn({
          id: key,
          title: toTitle("New chat"),
          meta: "Just now",
          docId,
          messages: [],
          qcount: 0,
          cites: [],
        });
        return [conv, ...prev];
      });
    };

    // Optimistically append the user message.
    const sentAt = new Date().toISOString();
    updateConv(convKey, (c) => ({
      ...c,
      messages: [...c.messages, { role: "user", text: prompt, createdAt: sentAt }],
      qcount: c.qcount + 1,
    }));
    if (!activeId) setActiveId(convKey);

    let key = convKey;
    let finalCitations: Citation[] = [];
    let streamed = false;

    const { promise, controller } = streamChat(
      { prompt, sessionId: activeId || undefined, documentId: docId },
      {
        onDelta: ({ text }) => {
          streamed = true;
          setSending(false);
          updateConv(key, (c) => {
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "ai") {
              msgs[msgs.length - 1] = { ...last, text: last.text + text };
            } else {
              msgs.push({ role: "ai", text, createdAt: new Date().toISOString() });
            }
            return { ...c, messages: msgs };
          });
        },
        onSession: ({ sessionId: sid, title }) => {
          const oldKey = key;
          key = sid;
          // Rename the optimistic (temp) conversation to the real session id.
          setConversations((prev) =>
            prev.map((c) =>
              c.id === oldKey
                ? { ...c, id: sid, title }
                : c.id === sid
                  ? { ...c, title }
                  : c,
            ),
          );
          setActiveId(sid);
        },
        onTitle: (title) => {
          updateConv(key, (c) => ({ ...c, title }));
        },
        onDone: (done) => {
          key = done.sessionId;
          finalCitations = done.citations ?? [];
          setSending(false);
          updateConv(key, (c) => {
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (!streamed) {
              if (last && last.role === "ai") {
                msgs[msgs.length - 1] = { ...last, citations: finalCitations };
              } else {
                msgs.push({
                  role: "ai",
                  text: "",
                  createdAt: new Date().toISOString(),
                  citations: finalCitations,
                });
              }
            } else if (last && last.role === "ai" && finalCitations.length) {
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], citations: finalCitations };
            }
            const cites = msgs.flatMap((m) => citationsFromMessage(m));
            return {
              ...c,
              id: done.sessionId,
              docId: done.documentId ?? docId,
              title: done.title || c.title,
              messages: msgs,
              cites,
              qcount: msgs.filter((m) => m.role === "user").length,
            };
          });
          setActiveId(done.sessionId);
        },
        onError: (message) => {
          setSending(false);
          setError(message);
          updateConv(key, (c) => ({
            ...c,
            messages: [
              ...c.messages,
              {
                role: "ai",
                text: `Error: ${message}`,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
        },
      },
    );

    streamRef.current = controller;
    await promise;
  };

  const refreshSummary = useCallback(async () => {
    if (!activeDocId) return;
    try {
      const text = await getSummary(activeDocId);
      setSummary(text);
    } catch (err) {
      setSummary(
        err instanceof Error ? err.message : "Could not load the summary.",
      );
    }
  }, [activeDocId]);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  const activeDocument = activeConversation
    ? docList.find((d) => d.id === activeConversation.docId) ?? null
    : docList.find((d) => d.id === activeDocId) ?? docList[0] ?? null;

  const percent = Math.max(status?.progress ?? 0, 3);
  const progressText = uploading
    ? status
      ? `${PROGRESS_LABEL[status.state] ?? "Processing…"} · ${Math.round(percent)}%`
      : "Uploading…"
    : "";

  const systemText = uploading
    ? uploadingFile
      ? `Indexing ${uploadingFile.name} — ${Math.round(percent)}%…`
      : "Uploading your document…"
    : activeDocument
      ? `${activeDocument.name} is ready — ${activeDocument.pages} pages indexed. Ask anything about the document and I'll reference exact pages in my answers.`
      : "Drop a document to start chatting. DocuMind will index it and answer with exact page references.";

  const inputHint = sending
    ? "DocuMind is thinking…"
    : uploading
      ? progressText
      : "Answers cite exact pages";

  return {
    docList,
    conversations,
    activeId,
    activeConversation,
    activeDocument,
    uploadingFile,
    uploading,
    sending,
    loadingHistory,
    error,
    input,
    percent,
    progressText,
    systemText,
    inputHint,
    summary,
    authenticated,
    user,
    logout,
    setInput,
    setError,
    onFiles,
    selectConversation,
    openDocConversation,
    newChat,
    clearConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    refreshSummary,
  };
}
