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
  sheetName?: string;
  rowIndex?: number;
  paragraphIndex?: number;
  sectionIndex?: number;
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

/**
 * Error carrying the HTTP status, so callers can branch on 404/401/429 rather
 * than string-matching a human-readable message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
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
    throw new ApiError(message, res.status);
  }

  return data as T;
}

/**
 * Fans a server frame out to the caller's handlers. Kept transport-agnostic so
 * the WebSocket event names and payloads stay in one place.
 */
function dispatchFrame(
  event: string,
  data: unknown,
  handlers: ChatStreamHandlers,
): void {
  const payload: { [key: string]: unknown } =
    typeof data === "object" && data !== null
      ? (data as { [key: string]: unknown })
      : { message: String(data ?? "") };

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
}

/**
 * Resolves the chat WebSocket base URL.
 *
 * The socket must bypass the Next.js rewrite layer, which does not proxy
 * upgrade requests, so we point straight at the backend. Set
 * `NEXT_PUBLIC_WS_URL` in production; in development we derive it from the
 * current hostname and the backend port.
 */
function wsBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:5000`;
  }

  return "ws://localhost:5000";
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
    // A 404 covers both "no such job" and "not yours": the server collapses the
    // two on purpose so this endpoint can't be used to probe which ids exist.
    // Polling treats it as "nothing to show yet" rather than a failure.
    if (err instanceof ApiError && err.status === 404) return null;
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
 * Streams a chat response from the backend over a WebSocket. One connection is
 * opened per turn: the prompt is sent on open, `delta` frames stream back, and
 * the server closes the socket once the turn ends. The returned promise
 * resolves when the socket closes; abort via the returned AbortController.
 */
export function streamChat(
  input: SendChatInput,
  handlers: ChatStreamHandlers,
): { promise: Promise<void>; controller: AbortController } {
  const controller = new AbortController();

  const promise = new Promise<void>((resolve) => {
    const token = getToken();

    if (!token) {
      handlers.onError("Not authenticated", 401);
      resolve();
      return;
    }

    // Browsers cannot set an Authorization header on a WebSocket handshake, so
    // the JWT travels as a query parameter.
    const url = `${wsBaseUrl()}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // Aborting closes the socket; the server sees the disconnect and stops
    // generating, so a cancelled message costs nothing.
    const onAbort = () => {
      try {
        socket.close();
      } catch {
        /* already closing */
      }
    };
    controller.signal.addEventListener("abort", onAbort, { once: true });

    socket.onopen = () => {
      socket.send(JSON.stringify(input));
    };

    socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(String(event.data)) as {
          event?: string;
          data?: unknown;
        };
        dispatchFrame(frame.event ?? "message", frame.data, handlers);
      } catch {
        /* ignore malformed frame */
      }
    };

    socket.onerror = () => {
      handlers.onError("Could not reach the chat server");
    };

    socket.onclose = (event) => {
      controller.signal.removeEventListener("abort", onAbort);
      // 4401 is the backend's unauthorized close code.
      if (event.code === 4401) {
        clearAuth();
        handlers.onError("Unauthorized", 401);
      }
      finish();
    };
  });

  return { promise, controller };
}
