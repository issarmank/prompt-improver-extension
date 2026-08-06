// ioredis client (Redis runs locally via docker-compose; TLS in production).
import { Redis } from 'ioredis';

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

export function createRedisClient(): Redis {
  // Managed Redis (e.g. Azure Cache on :6380) requires TLS but is still
  // usually configured with a redis:// URL, so an explicit flag turns it on.
  // A rediss:// URL enables TLS in ioredis by itself; the flag is additive.
  const useTls = (process.env.REDIS_TLS ?? '').toLowerCase() === 'true';
  return new Redis(REDIS_URL, {
    // Fail fast instead of retrying commands forever when Redis is down.
    maxRetriesPerRequest: 1,
    ...(useTls ? { tls: {} } : {}),
  });
}
