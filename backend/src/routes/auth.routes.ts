import { Router } from "express";
import type { IRoutes } from "./IRoutes";
import type { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middleware/authMiddleware";

export class AuthRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(private readonly authController: AuthController) {}

  public register(): Router {
    const router = Router();

    router.post("/auth/signup", this.authController.signup);
    router.post("/auth/login", this.authController.login);
    router.get("/auth/me", authenticateJWT, this.authController.me);
    router.get("/auth/google", this.authController.googleAuth);
    router.get("/auth/google/callback", this.authController.googleCallback);

    return router;
  }
}