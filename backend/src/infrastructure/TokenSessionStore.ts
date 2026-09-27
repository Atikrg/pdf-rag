import type IORedis from "ioredis";
import type { AppTokenPayload } from "../utils/jwt";

export const SESSION_KEY_PREFIX = "documind:session";

/**
 * Redis-backed auth session store. Registers issued JWTs (keyed by `jti`) with
 * the owning `userId` and a TTL matching the token lifetime. This enables
 * server-side validation and revocation of tokens, in addition to the
 * stateless JWT signature check.
 *
 * Fails open: if Redis is unavailable, tokens are not registered/validated via
 * Redis so existing stateless auth still works.
 */
export class TokenSessionStore {
  constructor(private readonly redis: IORedis) {}

  private key(jti: string): string {
    return `${SESSION_KEY_PREFIX}:${jti}`;
  }

  public async register(payload: {
    jti: string;
    userId: string;
    ttlSeconds: number;
  }): Promise<void> {
    try {
      await this.redis.set(
        this.key(payload.jti),
        payload.userId,
        "EX",
        payload.ttlSeconds,
      );
    } catch {
      // fail open
    }
  }

  /** Returns the userId registered for a token, or null if not found. */
  public async findUserId(jti: string): Promise<string | null> {
    try {
      const value = await this.redis.get(this.key(jti));
      return value ?? null;
    } catch {
      return null;
    }
  }

  public async isActive(jti: string): Promise<boolean> {
    const userId = await this.findUserId(jti);
    return userId !== null;
  }

  public async revoke(jti: string): Promise<void> {
    try {
      await this.redis.del(this.key(jti));
    } catch {
      // fail open
    }
  }
}

/**
 * A minimal "session" representation stored in Redis for optional user-scoped
 * data (for example, the issued-token record). Keyed by the user's id.
 */
export async function upsertUserSession(
  redis: IORedis,
  userId: string,
  data: Record<string, unknown>,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(
      `${SESSION_KEY_PREFIX}:user:${userId}`,
      JSON.stringify(data),
      "EX",
      ttlSeconds,
    );
  } catch {
    // fail open
  }
}

export async function getUserSession<T = Record<string, unknown>>(
  redis: IORedis,
  userId: string,
): Promise<T | null> {
  try {
    const value = await redis.get(`${SESSION_KEY_PREFIX}:user:${userId}`);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
