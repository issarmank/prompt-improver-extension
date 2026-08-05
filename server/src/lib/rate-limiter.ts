// rate-limiter-flexible configuration backed by Redis.
import type { Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

export const RATE_LIMIT_POINTS = Number(process.env.RATE_LIMIT_POINTS ?? 20);
export const RATE_LIMIT_DURATION_SECONDS = Number(
  process.env.RATE_LIMIT_DURATION_SECONDS ?? 3600,
);

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the next request is allowed. Only meaningful when blocked. */
  retryAfterSeconds: number;
}

export function createRateLimiter(
  redis: Redis,
  opts: { points?: number; durationSeconds?: number; keyPrefix?: string } = {},
): RateLimiterRedis {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: opts.keyPrefix ?? 'rl:rewrite',
    points: opts.points ?? RATE_LIMIT_POINTS,
    duration: opts.durationSeconds ?? RATE_LIMIT_DURATION_SECONDS,
  });
}

/** Consume one point for the given install id. Never throws on limit — returns a result. */
export async function consume(
  limiter: RateLimiterRedis,
  installId: string,
): Promise<ConsumeResult> {
  try {
    const res = await limiter.consume(installId, 1);
    return {
      allowed: true,
      remaining: res.remainingPoints,
      retryAfterSeconds: 0,
    };
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(err.msBeforeNext / 1000)),
      };
    }
    throw err;
  }
}
