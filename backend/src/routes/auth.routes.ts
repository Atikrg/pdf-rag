import { Router } from "express";
import type IORedis from "ioredis";
import type { IRoutes } from "./IRoutes";
import type { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimiter";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export class AuthRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(
    private readonly authController: AuthController,
    private readonly redis: IORedis,
  ) {}

  public register(): Router {
    const router = Router();

    // Signup and login are unauthenticated, so the limiter keys them on IP.
    // Login is the important one: without a limit, password guessing against
    // local accounts is unthrottled.
    const signupLimit = rateLimit(this.redis, {
      windowMs: FIFTEEN_MINUTES,
      limit: 5,
      prefix: "auth-signup",
      message: "Too many accounts created from this address. Try again later.",
    });

    const loginLimit = rateLimit(this.redis, {
      windowMs: FIFTEEN_MINUTES,
      limit: 10,
      prefix: "auth-login",
      message: "Too many login attempts. Try again later.",
    });

    const oauthLimit = rateLimit(this.redis, {
      windowMs: FIFTEEN_MINUTES,
      limit: 20,
      prefix: "auth-oauth",
      message: "Too many sign-in attempts. Try again later.",
    });

    // Deliberately tight: this endpoint sends a reset link that is a working
    // account-takeover primitive, so an attacker must not be able to spray
    // requests at guessed addresses.
    const forgotLimit = rateLimit(this.redis, {
      windowMs: FIFTEEN_MINUTES,
      limit: 5,
      prefix: "auth-forgot",
      message: "Too many reset requests. Try again later.",
    });

    // Brute-forcing a 32-byte token is infeasible, so this limit is here to
    // bound bcrypt CPU: each attempt costs a hash at signup's cost factor.
    const resetLimit = rateLimit(this.redis, {
      windowMs: FIFTEEN_MINUTES,
      limit: 10,
      prefix: "auth-reset",
      message: "Too many reset attempts. Try again later.",
    });

    router.post("/auth/signup", signupLimit, this.authController.signup);
    router.post("/auth/login", loginLimit, this.authController.login);
    router.post(
      "/auth/forgot-password",
      forgotLimit,
      this.authController.forgotPassword,
    );
    router.post(
      "/auth/reset-password",
      resetLimit,
      this.authController.resetPassword,
    );
    router.get("/auth/me", authenticateJWT, this.authController.me);
    router.get("/auth/google", oauthLimit, this.authController.googleAuth);
    router.get(
      "/auth/google/callback",
      oauthLimit,
      this.authController.googleCallback,
    );

    return router;
  }
}
