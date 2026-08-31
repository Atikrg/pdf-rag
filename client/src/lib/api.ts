export type JobState =
  | "completed"
  | "failed"
  | "active"
  | "waiting"
  | "delayed"
  | "paused"
  | "unknown";

export type JobStatus = {
  jobId: string;
  state: JobState;
  progress: number;
  result: { totalPages: number; totalChunks: number } | null;
  failedReason: string | null;
};

export type Citation = {
  pageIndex?: number;
  lines?: { from?: number; to?: number } | null;
};

export type UploadResponse = {
  success: boolean;
  jobId: string;
  documentId: string;
  fileName: string;
  message: string;
};

export type User = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export type AuthResponse = {
  success: boolean;
  token: string;
  user: User;
};

export type DocumentRecord = {
  id: string;
  originalName: string;
  totalPages: number | null;
  totalChunks: number | null;
  status: string;
  createdAt: string;
};

export type BackendMessage = {
  id: string;
  role: string;
  content: string;
  citations?: Citation[] | null;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionDetail = ChatSession & {
  document: { id: string; originalName: string } | null;
  messages: BackendMessage[];
};

export type CreateSessionInput = {
  documentId?: string;
};

export type SendChatInput = {
  prompt: string;
  sessionId?: string;
  documentId?: string;
};

export type ChatDelta = {
  text: string;
};

export type ChatDone = {
  sessionId: string;
  documentId?: string;
  title: string;
  citations: Citation[];
  references: number;
};

export type ChatStreamHandlers = {
  onDelta: (delta: ChatDelta) => void;
  onSession?: (session: { sessionId: string; title: string }) => void;
  onTitle?: (title: string) => void;
  onDone: (done: ChatDone) => void;
  onError: (message: string, code?: number) => void;
};

const TOKEN_KEY = "documind_token";
const USER_KEY = "documind_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  setToken(null);
  setStoredUser(null);
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    clearAuth();
  }

  let data: unknown;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const body =
      typeof data === "object" && data !== null
        ? (data as { message?: unknown; error?: unknown })
        : {};
    const message =
      (typeof body.message === "string" ? body.message : undefined) ??
      (typeof body.error === "string" ? body.error : undefined) ??
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (event: string, rawData: string) => {
    let payload: { [key: string]: unknown };
    try {
      const parsed: unknown = JSON.parse(rawData);
      payload =
        typeof parsed === "object" && parsed !== null
          ? (parsed as { [key: string]: unknown })
          : { message: rawData };
    } catch {
      payload = { message: rawData };
    }

    switch (event) {
      case "delta":
        if (typeof payload.text === "string") {
          handlers.onDelta({ text: payload.text });
        }
        break;
      case "session":
        handlers.onSession?.(payload as { sessionId: string; title: string });
        break;
      case "title":
        if (typeof payload.title === "string") handlers.onTitle?.(payload.title);
        break;
      case "done":
        handlers.onDone(payload as unknown as ChatDone);
        break;
      case "error":
        handlers.onError(
          typeof payload.message === "string" ? payload.message : "Unknown error",
          typeof payload.code === "number" ? payload.code : undefined,
        );
        break;
      default:
        break;
    }
  };

  return (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);

        let event = "message";
        let dataLine = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
        }
        if (dataLine) handleEvent(event, dataLine);
      }
    }
  })();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function fetchMe(): Promise<User> {
  const data = await apiFetch<{ success: boolean; user: User }>("/api/auth/me");
  setStoredUser(data.user);
  return data.user;
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("pdf", file);
  return apiFetch<UploadResponse>("/api/upload", {
    method: "POST",
    body: form,
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    return await apiFetch<JobStatus>(`/api/upload/status/${jobId}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const data = await apiFetch<{ success: string; documents: DocumentRecord[] }>(
    "/api/documents",
  );
  return data.documents ?? [];
}

export async function listSessions(): Promise<ChatSession[]> {
  const data = await apiFetch<{ success: boolean; sessions: ChatSession[] }>(
    "/api/sessions",
  );
  return data.sessions ?? [];
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const data = await apiFetch<{ success: boolean; session: SessionDetail }>(
    `/api/sessions/${sessionId}`,
  );
  return data.session;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<ChatSession> {
  const data = await apiFetch<{ success: boolean; session: ChatSession }>(
    "/api/sessions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
}

export async function getSummary(documentId: string): Promise<string> {
  const data = await apiFetch<{ success: boolean; summary: string }>(
    `/api/documents/${documentId}/summary`,
  );
  return data.summary;
}

/**
 * Streams a chat response from the backend over Server-Sent Events. Returns a
 * promise that resolves when the stream is fully consumed (after a `done` or
 * `error` event). Abortable via the returned AbortController.
 */
export function streamChat(
  input: SendChatInput,
  handlers: ChatStreamHandlers,
): { promise: Promise<void>; controller: AbortController } {
  const controller = new AbortController();
  const token = getToken();

  const promise = (async () => {
    const res = await fetch("/api/chat", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!res.ok || !res.body) {
      let message = `Failed to get a response (${res.status})`;
      try {
        const data = await res.json();
        message = data?.message ?? message;
      } catch {
        /* ignore */
      }
      handlers.onError(message, res.status);
      return;
    }

    const reader = res.body.getReader();
    await parseSSEStream(reader, handlers);
  })();

  return { promise, controller };
}
