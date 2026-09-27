import { container } from "./container/container";
import { errorHandler } from "./middleware/errorHandler";
import { setupGracefulShutdown } from "./utils/gracefulShutdown";
import { attachChatWebSocket } from "./websocket/chatWebSocket";

const app = container.buildApp();

app.use(errorHandler);

(async () => {
  try {
    await container.connectInfrastructure();
  } catch (error: any) {
    console.error(error?.message ?? "Infrastructure connection failed");
    process.exit(1);
  }
})();

const SERVER_PORT = container.config.serverPort;

const server = app.listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${SERVER_PORT}`);
});

// Chat streaming runs over WebSockets rather than SSE. Browsers connect here
// directly, bypassing the Next.js rewrite layer, which cannot proxy upgrade
// requests.
attachChatWebSocket({
  server,
  chatController: container.chatController,
  redis: container.getRedisConnection(),
  allowedOrigins: container.config.allowedWsOrigins,
});

setupGracefulShutdown(server, container);
