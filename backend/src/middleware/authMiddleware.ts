import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { verifyClerkToken, getClerkUser } from "../lib/clerk";
import { UserService } from "../services/user.service";

const userService = new UserService();

/**
 * Authenticates requests. Accepts either an app-issued JWT
 * (`Authorization: Bearer <token>` where the payload carries `userId`) or a
 * Clerk-issued session token. On success it resolves the internal DB user
 * (creating it for Clerk tokens) and sets `request.userId` to the DB user id
 * and `request.clerkId` to the Clerk `sub` when present.
 */
export async function authenticateJWT(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

    if (token) {
      // 1) Try the app-issued JWT first (works without any Clerk keys).
      const payload = verifyToken(token);
      const user = await userService.findById(payload.userId);
      if (user) {
        request.userId = user.id;
        request.clerkId = user.clerkId ?? undefined;
        return next();
      }
    }

    // 2) Fall back to Clerk session tokens.
    if (token && process.env.CLERK_SECRET_KEY) {
      const claims = (await verifyClerkToken(token)) as any;
      const clerkId: string | undefined = claims?.sub;

      if (!clerkId) {
        return response.status(401).json({ message: "Invalid or expired token" });
      }

      const user = await userService.ensureUser(
        clerkId,
        await getClerkUser(clerkId),
      );

      request.userId = user.id;
      request.clerkId = clerkId;

      return next();
    }

    // 3) Development fallback used when no auth is configured at all.
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.CLERK_SECRET_KEY
    ) {
      const dev = await userService.ensureUser("dev-user", {
        email: null,
        firstName: "Dev",
        lastName: "User",
      });
      request.userId = dev.id;
      request.clerkId = "dev-user";
      return next();
    }

    return response.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error("Auth error:", error);
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}