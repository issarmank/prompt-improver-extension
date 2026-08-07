// Unit tests for the backend client and the service worker's error mapping.
// chrome.* and fetch are mocked — no real browser or backend involved.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The service worker registers its onMessage listener at import time, so the
// chrome stub must exist before any module import is evaluated.
const { chromeStub, localStore, fetchMock } = vi.hoisted(() => {
  const localStore = new Map<string, unknown>();
  const chromeStub = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => {
          return localStore.has(key) ? { [key]: localStore.get(key) } : {};
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) localStore.set(k, v);
        }),
      },
    },
    runtime: {
      onMessage: { addListener: vi.fn() },
    },
  };
  const fetchMock = vi.fn<typeof fetch>();
  (globalThis as Record<string, unknown>).chrome = chromeStub;
  return { chromeStub, localStore, fetchMock };
});

import {
  BackendError,
  getOrCreateInstallId,
  rewrite,
} from '../src/lib/backend-client';
import { handleRewrite } from '../src/background/service-worker';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  vi.stubGlobal('chrome', chromeStub);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  chromeStub.storage.local.get.mockClear();
  chromeStub.storage.local.set.mockClear();
  localStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getOrCreateInstallId', () => {
  it('generates an id on first use and persists it to chrome.storage.local', async () => {
    const id = await getOrCreateInstallId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,128}$/); // must satisfy the server's header check
    expect(localStore.get('installId')).toBe(id);
  });

  it('returns the stored id on later calls without regenerating', async () => {
    localStore.set('installId', 'existing-install-id');
    const id = await getOrCreateInstallId();
    expect(id).toBe('existing-install-id');
    expect(chromeStub.storage.local.set).not.toHaveBeenCalled();
  });

  it('is stable across calls', async () => {
    const first = await getOrCreateInstallId();
    const second = await getOrCreateInstallId();
    expect(second).toBe(first);
  });
});

describe('rewrite', () => {
  it('POSTs the text with the install id in X-Install-Id', async () => {
    localStore.set('installId', 'install-abc-123');
    fetchMock.mockResolvedValue(jsonResponse(200, { improved: 'Better.', remaining: 7 }));

    const result = await rewrite('make this better');
    expect(result).toEqual({ improved: 'Better.', remaining: 7 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:8787/rewrite');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>)['X-Install-Id']).toBe(
      'install-abc-123',
    );
    expect(JSON.parse(init!.body as string)).toEqual({ text: 'make this better' });
  });

  it('maps the backend 429 to rate_limited with retry-after from the header', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        429,
        { error: 'rate_limited', retryAfterSeconds: 120 },
        { 'Retry-After': '120' },
      ),
    );
    const err = (await rewrite('x').catch((e) => e)) as BackendError;
    expect(err).toBeInstanceOf(BackendError);
    expect(err.kind).toBe('rate_limited');
    expect(err.retryAfterSeconds).toBe(120);
  });

  it('maps llm_rate_limited distinctly from the backend limiter 429', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, { error: 'llm_rate_limited' }));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'llm_rate_limited' });
  });

  it('maps llm_timeout and llm_not_configured', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(504, { error: 'llm_timeout' }));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'llm_timeout' });

    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: 'llm_not_configured' }));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'llm_not_configured' });
  });

  it('maps llm_error distinctly from the generic server_error fallback', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, { error: 'llm_error' }));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'llm_error' });
  });

  it('maps internal_error distinctly from the generic server_error fallback', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'internal_error' });
  });

  it('maps a client-side timeout to timeout', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('maps an unreachable backend to network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('treats an invalid success body as server_error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { nope: true }));
    await expect(rewrite('x')).rejects.toMatchObject({ kind: 'server_error' });
  });
});

describe('handleRewrite (service worker)', () => {
  it('returns the improved text on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { improved: 'Polished.', remaining: 3 }));
    const res = await handleRewrite('rough draft');
    expect(res).toEqual({ ok: true, improved: 'Polished.', remaining: 3 });
  });

  it('gives the backend 429 and the LLM 429 distinct user-facing messages', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: 'rate_limited' }, { 'Retry-After': '90' }),
    );
    const limited = await handleRewrite('x');

    fetchMock.mockResolvedValueOnce(jsonResponse(502, { error: 'llm_rate_limited' }));
    const upstream = await handleRewrite('x');

    expect(limited.ok).toBe(false);
    expect(upstream.ok).toBe(false);
    if (limited.ok || upstream.ok) return;
    expect(limited.kind).toBe('rate_limited');
    expect(upstream.kind).toBe('llm_rate_limited');
    expect(limited.message).not.toBe(upstream.message);
    expect(limited.message).toContain('Try again in');
    expect(limited.retryAfterSeconds).toBe(90);
  });

  it('reports a network failure with its own message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await handleRewrite('x');
    expect(res).toMatchObject({ ok: false, kind: 'network' });
    if (!res.ok) expect(res.message).toContain('reach');
  });

  it('registers a chrome.runtime.onMessage listener', () => {
    expect(chromeStub.runtime.onMessage.addListener).toHaveBeenCalled();
  });
});
