// CORS middleware: only the extension's own origin may call from a browser.
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allowedOriginsFromEnv,
  corsForExtension,
} from '../src/middleware/cors.js';

const EXT_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

function makeApp(origins: string[]): express.Express {
  const app = express();
  app.use(corsForExtension(origins));
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/rewrite', (_req, res) => {
    res.json({ improved: 'x' });
  });
  return app;
}

describe('corsForExtension', () => {
  it('lets requests without an Origin header through untouched (curl, probes)', async () => {
    const res = await request(makeApp([EXT_ORIGIN])).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('reflects the extension origin on allowed requests', async () => {
    const res = await request(makeApp([EXT_ORIGIN]))
      .post('/rewrite')
      .set('Origin', EXT_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(EXT_ORIGIN);
    expect(res.headers['vary']).toContain('Origin');
  });

  it('rejects browser requests from any other origin with 403', async () => {
    const res = await request(makeApp([EXT_ORIGIN]))
      .post('/rewrite')
      .set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden_origin');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects other extensions, not just web pages', async () => {
    const res = await request(makeApp([EXT_ORIGIN]))
      .post('/rewrite')
      .set('Origin', 'chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    expect(res.status).toBe(403);
  });

  it('answers preflight for the allowed origin with the methods and headers the extension uses', async () => {
    const res = await request(makeApp([EXT_ORIGIN]))
      .options('/rewrite')
      .set('Origin', EXT_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(EXT_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toContain(
      'X-Install-Id',
    );
  });

  it('denies every browser origin when no origin is configured', async () => {
    const res = await request(makeApp([]))
      .post('/rewrite')
      .set('Origin', EXT_ORIGIN);
    expect(res.status).toBe(403);
  });
});

describe('allowedOriginsFromEnv', () => {
  afterEach(() => {
    delete process.env.EXTENSION_ORIGIN;
  });

  it('returns an empty list when unset', () => {
    delete process.env.EXTENSION_ORIGIN;
    expect(allowedOriginsFromEnv()).toEqual([]);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    process.env.EXTENSION_ORIGIN = `${EXT_ORIGIN}, chrome-extension://second`;
    expect(allowedOriginsFromEnv()).toEqual([
      EXT_ORIGIN,
      'chrome-extension://second',
    ]);
  });
});
