import type { NextFunction, Request, Response } from "express";
import type IORedis from "ioredis";

export type RateLimitOptions = {
  windowMs: number;
  limit: number;
  /** Optional key suffix, e.g. the route name, for per-route limits. */
  prefix?: string;
  /** Message returned when the limit is exceeded. */
  message?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

/**
 * Consumes one unit from a Redis sliding window and reports whether the caller
 * is within its allowance. Exposed separately from the Express middleware so
 * non-HTTP transports (WebSocket) apply the same limits.
 *
 * Fails open: if Redis is unavailable the caller is allowed through.
 */
export async function consumeRateLimit(
  redis: IORedis,
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { windowMs, limit, prefix = "ratelimit" } = options;
  const key = `documind:${prefix}:${identifier}:${Math.floor(Date.now() / windowMs)}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
    };
  } catch {
    // fail open
    return { allowed: true, remaining: limit, limit };
  }
}

/**
 * Sliding-window rate limiter backed by Redis. Uses INCR on a per-client key;
 * when the key hits 1 the TTL is set, so the counter expires after `windowMs`.
 *
 * Fails open: if Redis is unavailable, requests are allowed through.
 */
export function rateLimit(redis: IORedis, options: RateLimitOptions) {
  const { message = "Too many requests, please try again later." } = options;

  return async (request: Request, response: Response, next: NextFunction) => {
    const identifier = request.userId
      ? `user:${request.userId}`
      : `ip:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`;

    const result = await consumeRateLimit(redis, identifier, options);

    response.setHeader("X-RateLimit-Limit", String(result.limit));
    response.setHeader("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      return response.status(429).json({ success: "fail", message });
    }

    next();
  };
}
