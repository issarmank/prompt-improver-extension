// Unit tests for the OpenRouter client with a mocked fetch — no network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmError, rewritePrompt } from '../src/lib/llm.js';

const FAKE_KEY = 'sk-or-test-key-1234567890';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function completion(content: string) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', FAKE_KEY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('rewritePrompt', () => {
  it('sends the prompt to OpenRouter with the right model, auth, and system instruction', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, completion('Rewritten.')));

    const result = await rewritePrompt('make my code fast');
    expect(result.improved).toBe('Rewritten.');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${FAKE_KEY}`,
    );

    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('openai/gpt-4o-mini');
    expect(body.provider).toEqual({ sort: 'throughput' });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toMatch(/rewrite/i);
    expect(body.messages[1]).toEqual({
      role: 'user',
      content: 'make my code fast',
    });
  });

  it('trims whitespace from the completion', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, completion('  Better prompt.\n')));
    const result = await rewritePrompt('x');
    expect(result.improved).toBe('Better prompt.');
  });

  it('throws not_configured when OPENROUTER_API_KEY is unset, without calling fetch', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    await expect(rewritePrompt('x')).rejects.toMatchObject({
      name: 'LlmError',
      kind: 'not_configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps OpenRouter 429 to upstream_rate_limited', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { error: 'slow down' }));
    await expect(rewritePrompt('x')).rejects.toMatchObject({
      kind: 'upstream_rate_limited',
    });
  });

  it('maps OpenRouter 5xx to upstream_error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    await expect(rewritePrompt('x')).rejects.toMatchObject({
      kind: 'upstream_error',
    });
  });

  it('maps an aborted request to timeout', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(rewritePrompt('x')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('treats an empty completion as upstream_error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, completion('')));
    await expect(rewritePrompt('x')).rejects.toMatchObject({
      kind: 'upstream_error',
    });
  });

  it('never leaks the API key in error messages', async () => {
    const failures = [
      jsonResponse(429, {}),
      jsonResponse(500, {}),
      new Response('not json', { status: 200 }),
    ];
    for (const failure of failures) {
      fetchMock.mockResolvedValueOnce(failure);
      const err = (await rewritePrompt('x').catch((e) => e)) as LlmError;
      expect(err).toBeInstanceOf(LlmError);
      expect(err.message).not.toContain(FAKE_KEY);
    }
  });
});
