// ioredis client (Redis runs locally via docker-compose).
import { Redis } from 'ioredis';

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

export function createRedisClient(): Redis {
  return new Redis(REDIS_URL, {
    // Fail fast instead of retrying commands forever when Redis is down.
    maxRetriesPerRequest: 1,
  });
}
