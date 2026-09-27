import type { Server as HttpServer } from "node:http";
import type IORedis from "ioredis";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import type { ChatController } from "../controllers/chat.controller";
import {
  authenticateToken,
  developmentIdentity,
} from "../middleware/authMiddleware";
import { consumeRateLimit } from "../middleware/rateLimiter";

export const CHAT_WS_PATH = "/ws";

type AttachOptions = {
  server: HttpServer;
  chatController: ChatController;
  redis: IORedis;
  /** Origins permitted to open a socket. Empty/undefined allows any origin. */
  allowedOrigins?: string[];
};

/**
 * Serves the chat turn over WebSockets.
 *
 * The browser cannot set an `Authorization` header on a WebSocket handshake, so
 * the JWT arrives as a `token` query parameter. Because the client connects
 * directly to this server (Next.js rewrites do not proxy upgrade requests), the
 * `Origin` header is checked explicitly against an allowlist — without that,
 * any site could open an authenticated socket using a token it observed.
 *
 * Connection lifecycle is one socket per turn: the client sends a single chat
 * request, receives `delta`/`done`/`error` frames, and the server closes.
 */
export function attachChatWebSocket({
  server,
  chatController,
  redis,
  allowedOrigins,
}: AttachOptions): WebSocketServer {
  const wss = new WebSocketServer({ server, path: CHAT_WS_PATH });

  const originAllowed = (origin: string | undefined) => {
    if (!allowedOrigins || allowedOrigins.length === 0) return true;
    if (!origin) return false;
    return allowedOrigins.includes(origin);
  };

  wss.on("connection", (socket: WebSocket, request) => {
    // The client sends its prompt the instant the socket opens, but auth and
    // rate limiting below are async. Buffer frames from the very first tick so
    // that message isn't dropped while we are still authenticating.
    const inbox: string[] = [];
    let wake: (() => void) | null = null;

    socket.on("message", (data: unknown) => {
      inbox.push(
        typeof data === "string"
          ? data
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : String(data),
      );
      wake?.();
    });

    void handleConnection(
      socket,
      request.url ?? "",
      request.headers.origin,
      async () => {
        if (inbox.length > 0) return inbox.shift()!;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = null;
        return inbox.shift() ?? null;
      },
    );
  });

  async function handleConnection(
    socket: WebSocket,
    url: string,
    origin: string | undefined,
    takeMessage: () => Promise<string | null>,
  ) {
    const send = (event: string, data: unknown) => {
      if (socket.readyState !== socket.OPEN) return;
      socket.send(JSON.stringify({ event, data }));
    };

    const closeWith = async (message: string, code = 1008) => {
      send("error", { message, code });
      socket.close(code);
    };

    try {
      if (!originAllowed(origin)) {
        await closeWith("Origin not allowed", 1008);
        return;
      }

      const params = new URL(url, "http://localhost").searchParams;
      const token = params.get("token") ?? undefined;

      const identity =
        (await authenticateToken(token)) ?? (await developmentIdentity());

      if (!identity) {
        // 4401 is a private-use code carrying our 401 semantics.
        socket.close(4401, "Unauthorized");
        return;
      }

      const limit = await consumeRateLimit(redis, `user:${identity.userId}`, {
        windowMs: 60 * 1000,
        limit: 100,
        prefix: "chat",
      });

      if (!limit.allowed) {
        await closeWith("Too many chat requests, please slow down.", 429);
        return;
      }

      // One request frame per connection.
      const raw = await takeMessage();
      if (raw === null) return; // socket closed before sending a prompt

      let input: unknown;
      try {
        input = JSON.parse(raw);
      } catch {
        await closeWith("Malformed chat request", 400);
        return;
      }

      // If the client aborts mid-stream, stop generating rather than finishing
      // an answer nobody will read.
      const abort = new AbortController();
      socket.once("close", () => abort.abort());

      await chatController.streamTurn(input, identity.userId, { send }, abort.signal);

      if (abort.signal.aborted) return; // client already gone
      socket.close(1000);
    } catch (error: any) {
      console.error("WebSocket chat error:", error);
      send("error", { message: error?.message ?? "Internal Server Error", code: 500 });
      socket.close(1011);
    }
  }

  return wss;
}
