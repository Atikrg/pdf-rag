import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { Container } from "../container/container";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Installs graceful shutdown handlers for SIGINT / SIGTERM.
 *
 * Flow:
 *   1. Stop accepting new connections (server.close).
 *   2. Wait for in-flight requests to finish (drain). Streaming/SSE responses
 *      count as in-flight until they end.
 *   3. Once drained, release infrastructure connections (Redis, etc.) and
 *      exit cleanly.
 *   4. If anything is still open after the timeout, force-close the remaining
 *      sockets and exit regardless.
 */
export function setupGracefulShutdown(
  server: Server,
  container: Container,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
  let shuttingDown = false;

  // Track sockets from setup time so we can force-close any that refuse to
  // drain during shutdown (e.g. long-lived SSE connections).
  const sockets = new Set<Socket>();
  const trackSocket = (socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  };
  server.on("connection", trackSocket);

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    // The force-exit timer is the backstop for any stream/socket that refuses
    // to drain within the allowed window.
    const forceExit = setTimeout(() => {
      console.error(
        `Graceful shutdown timed out after ${timeoutMs}ms, forcing exit.`,
      );
      for (const socket of sockets) {
        socket.destroy();
      }
      process.exit(1);
    }, timeoutMs);
    forceExit.unref();

    server.close(async (err) => {
      if (err) {
        console.error("Error while closing server:", err.message);
      }
      console.log("HTTP server drained and closed.");

      clearTimeout(forceExit);

      try {
        await container.disconnect();
      } catch (error) {
        console.error("Error during resource cleanup:", error);
      }

      console.log("Graceful shutdown complete. Exiting.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
