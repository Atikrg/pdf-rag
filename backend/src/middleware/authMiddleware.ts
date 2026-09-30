import type { NextFunction, Request, Response } from "express";
import { AppConfig } from "../config/AppConfig";
import { verifyToken } from "../utils/jwt";
import { verifyClerkToken, getClerkUser } from "../lib/clerk";
import { UserService } from "../services/user.service";

const userService = new UserService();

export type AuthenticatedIdentity = {
  userId: string;
  clerkId?: string;
};

/**
 * Resolves a bearer token to a DB user. Shared by the HTTP middleware and the
 * WebSocket handshake, which cannot set an `Authorization` header and therefore
 * carries the token as a query parameter.
 *
 * Returns `null` when the token is missing, invalid, or expired.
 */
export async function authenticateToken(
  token: string | undefined,
): Promise<AuthenticatedIdentity | null> {
  if (!token) return null;

  // 1) Try the app-issued JWT first (works without any Clerk keys).
  try {
    const payload = verifyToken(token);
    const user = await userService.findById(payload.userId);
    if (user) {
      return { userId: user.id, clerkId: user.clerkId ?? undefined };
    }
  } catch {
    // Not an app-issued token; fall through to Clerk.
  }

  // 2) Fall back to Clerk session tokens.
  if (process.env.CLERK_SECRET_KEY) {
    const claims = (await verifyClerkToken(token)) as any;
    const clerkId: string | undefined = claims?.sub;
    if (!clerkId) return null;

    const user = await userService.ensureUser(
      clerkId,
      await getClerkUser(clerkId),
    );

    return { userId: user.id, clerkId };
  }

  return null;
}

/**
 * Development fallback used when no auth is configured at all.
 *
 * Requires `ALLOW_DEV_AUTH=true` explicitly. It used to be implied by
 * `NODE_ENV=development`, which meant the Docker backend — published on port
 * 5000 and run with exactly that value — answered every unauthenticated request
 * as one shared "dev-user", so all users shared one document quota and could
 * read each other's uploads.
 */
export async function developmentIdentity(): Promise<AuthenticatedIdentity | null> {
  if (!AppConfig.getInstance().allowDevAuth || process.env.CLERK_SECRET_KEY) {
    return null;
  }

  const dev = await userService.ensureUser("dev-user", {
    email: null,
    firstName: "Dev",
    lastName: "User",
  });

  return { userId: dev.id, clerkId: "dev-user" };
}

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

    const identity =
      (await authenticateToken(token)) ?? (await developmentIdentity());

    if (!identity) {
      return response.status(401).json({ message: "Unauthorized" });
    }

    request.userId = identity.userId;
    request.clerkId = identity.clerkId;
    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}