import type IORedis from "ioredis";

export const CACHE_KEY_PREFIX = "documind:cache";

/**
 * Thin JSON serializer around an IORedis connection. Used for caching API
 * responses with TTLs. Fails open: if Redis is unavailable, cache reads return
 * null and writes are no-ops so the app never crashes because of caching.
 */
export class RedisCache {
  constructor(private readonly redis: IORedis) {}

  private key(raw: string): string {
    return `${CACHE_KEY_PREFIX}:${raw}`;
  }

  public async get<T>(rawKey: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.key(rawKey));
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  public async set<T>(
    rawKey: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(this.key(rawKey), serialized, "EX", ttlSeconds);
      } else {
        await this.redis.set(this.key(rawKey), serialized);
      }
    } catch {
      // fail open: ignore cache write errors
    }
  }

  public async del(rawKey: string): Promise<void> {
    try {
      await this.redis.del(this.key(rawKey));
    } catch {
      // fail open
    }
  }

  public async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${CACHE_KEY_PREFIX}:${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch {
      // fail open
    }
  }
}
