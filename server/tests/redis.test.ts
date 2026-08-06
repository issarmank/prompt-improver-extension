// Redis client construction: REDIS_TLS=true must turn on TLS for redis:// URLs
// (managed Redis like Azure Cache requires TLS on :6380 but is still usually
// configured with a redis:// URL).
import type { Redis } from 'ioredis';
import { afterEach, describe, expect, it } from 'vitest';
import { createRedisClient } from '../src/lib/redis.js';

let client: Redis | undefined;

afterEach(() => {
  delete process.env.REDIS_TLS;
  if (client) {
    // Swallow the connection-refused error from tearing down mid-connect.
    client.on('error', () => {});
    client.disconnect();
    client = undefined;
  }
});

describe('createRedisClient', () => {
  it('does not use TLS by default', () => {
    client = createRedisClient();
    expect(client.options.tls).toBeUndefined();
  });

  it('enables TLS when REDIS_TLS=true', () => {
    process.env.REDIS_TLS = 'true';
    client = createRedisClient();
    expect(client.options.tls).toBeDefined();
  });

  it('treats anything other than "true" as off', () => {
    process.env.REDIS_TLS = 'false';
    client = createRedisClient();
    expect(client.options.tls).toBeUndefined();
  });
});
