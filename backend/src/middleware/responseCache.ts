import type { NextFunction, Request, Response } from "express";
import { RedisCache } from "../infrastructure/RedisCache";

/**
 * Caches successful JSON GET responses in Redis. Keyed by the authenticated
 * userId (or a guest identifier) + request path, with a TTL.
 *
 * On a cache hit, the cached body is returned directly. On a miss, the
 * response is intercepted, serialized on success, and stored.
 */
export function cacheResponse(
  cache: RedisCache,
  ttlSeconds = 60,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return next();
    }

    const scope = request.userId ?? `guest:${request.ip ?? "unknown"}`;
    const rawKey = `${request.originalUrl}|${scope}`;

    cache
      .get<string>(rawKey)
      .then((cached) => {
        if (cached) {
          response.setHeader("X-Cache", "HIT");
          response
            .status(200)
            .type("json")
            .send(cached);
          return;
        }

        const originalJson = response.json.bind(response);
        const originalSend = response.send.bind(response);

        response.json = (body: unknown) => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            void cache.set(rawKey, JSON.stringify(body), ttlSeconds);
          }
          originalJson(body);
          return response;
        };

        response.send = (body?: unknown) => {
          if (
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            typeof body === "string" &&
            response.getHeader("Content-Type")?.toString().includes("application/json")
          ) {
            void cache.set(rawKey, body, ttlSeconds);
          }
          return originalSend(body);
        };

        next();
      })
      .catch(() => next());
  };
}
