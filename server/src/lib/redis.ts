// ioredis client (Redis runs locally via docker-compose; Upstash in production).
import { Redis } from 'ioredis';

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

export function createRedisClient(): Redis {
  // Some managed Redis hosts require TLS but hand out a redis:// URL, so an
  // explicit flag turns it on. A rediss:// URL (Upstash) enables TLS in
  // ioredis by itself; the flag is additive.
  const useTls = (process.env.REDIS_TLS ?? '').toLowerCase() === 'true';
  return new Redis(REDIS_URL, {
    // Fail fast instead of retrying commands forever when Redis is down.
    maxRetriesPerRequest: 1,
    // index.ts builds the app at import time (Vercel's entry point, and the
    // tests import it), so don't open a socket until the first command.
    lazyConnect: true,
    ...(useTls ? { tls: {} } : {}),
  });
}
