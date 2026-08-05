// Runs against a real local Redis: `docker compose up -d` in server/ first.
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/index.js';
import {
  RATE_LIMIT_POINTS,
  consume,
  createRateLimiter,
} from '../src/lib/rate-limiter.js';
import { createRedisClient } from '../src/lib/redis.js';

let redis: Redis;

beforeAll(async () => {
  redis = createRedisClient();
  try {
    await redis.ping();
  } catch {
    throw new Error(
      'Redis is not reachable — start it with `docker compose up -d` in server/',
    );
  }
});

afterAll(async () => {
  await redis.quit();
});

beforeEach(async () => {
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) await redis.del(...keys);
});

describe('rate limiter (lib)', () => {
  it('allows requests under the limit and reports remaining points', async () => {
    const limiter = createRateLimiter(redis, {
      points: 3,
      durationSeconds: 60,
      keyPrefix: 'rl:test-lib',
    });

    const first = await consume(limiter, 'install-lib-a');
    expect(first).toMatchObject({ allowed: true, remaining: 2 });

    await consume(limiter, 'install-lib-a');
    const third = await consume(limiter, 'install-lib-a');
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('blocks once the limit is exhausted and reports retry-after', async () => {
    const limiter = createRateLimiter(redis, {
      points: 2,
      durationSeconds: 60,
      keyPrefix: 'rl:test-lib',
    });

    await consume(limiter, 'install-lib-b');
    await consume(limiter, 'install-lib-b');
    const blocked = await consume(limiter, 'install-lib-b');

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('tracks limits per install id independently', async () => {
    const limiter = createRateLimiter(redis, {
      points: 1,
      durationSeconds: 60,
      keyPrefix: 'rl:test-lib',
    });

    const a = await consume(limiter, 'install-lib-c');
    const b = await consume(limiter, 'install-lib-d');
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);

    const aAgain = await consume(limiter, 'install-lib-c');
    expect(aAgain.allowed).toBe(false);
  });
});

describe('POST /rewrite (HTTP)', () => {
  it('returns 400 when X-Install-Id is missing', async () => {
    const app = createApp(redis);
    const res = await request(app).post('/rewrite').send({ text: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_install_id');
  });

  it('returns 400 for a missing or empty text body', async () => {
    const app = createApp(redis);
    const res = await request(app)
      .post('/rewrite')
      .set('X-Install-Id', 'install-http-body')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('rewrites under the limit, then returns 429 with Retry-After over it', async () => {
    const app = createApp(redis);
    const installId = 'install-http-limit';

    for (let i = 0; i < RATE_LIMIT_POINTS; i++) {
      const res = await request(app)
        .post('/rewrite')
        .set('X-Install-Id', installId)
        .send({ text: 'make this prompt better' });
      expect(res.status).toBe(200);
      expect(res.body.improved).toBe('make this prompt better');
    }

    const blocked = await request(app)
      .post('/rewrite')
      .set('X-Install-Id', installId)
      .send({ text: 'one too many' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('rate_limited');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });
});
