import { Router } from "express";
import type { IRoutes } from "./IRoutes";
import type { ChatController } from "../controllers/chat.controller";
import { authenticateJWT } from "../middleware/authMiddleware";

export class ChatRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(private readonly chatController: ChatController) {}

  public register(): Router {
    const router = Router();

    // Chat streaming is served over WebSockets at /ws (see websocket/chatWebSocket.ts).
    // These are the plain request/response session endpoints.

    // Chat session management
    router.post("/sessions", authenticateJWT, this.chatController.createSession);
    router.get("/sessions", authenticateJWT, this.chatController.listSessions);
    router.get(
      "/sessions/:id",
      authenticateJWT,
      this.chatController.getSession,
    );
    router.patch(
      "/sessions/:id",
      authenticateJWT,
      this.chatController.renameSession,
    );
    router.delete(
      "/sessions/:id",
      authenticateJWT,
      this.chatController.deleteSession,
    );

    return router;
  }
}
