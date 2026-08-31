import { Router } from "express";
import type { IRoutes } from "./IRoutes";
import type { ChatController } from "../controllers/chat.controller";
import { authenticateJWT } from "../middleware/authMiddleware";

export class ChatRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(private readonly chatController: ChatController) {}

  public register(): Router {
    const router = Router();

    // Streaming chat (Server-Sent Events)
    router.post("/chat", authenticateJWT, this.chatController.chat);

    // Chat session management
    router.post("/sessions", authenticateJWT, this.chatController.createSession);
    router.get("/sessions", authenticateJWT, this.chatController.listSessions);
    router.get(
      "/sessions/:id",
      authenticateJWT,
      this.chatController.getSession,
    );
    router.delete(
      "/sessions/:id",
      authenticateJWT,
      this.chatController.deleteSession,
    );

    return router;
  }
}
