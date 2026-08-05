// Calls OpenRouter's chat completions API to rewrite a prompt.
// The API key is read from env at call time and must never appear in logs,
// error messages, or responses.
import { Agent, setGlobalDispatcher } from 'undici';

// Improve clicks are sporadic, and undici's default agent drops idle
// connections after ~4s — so nearly every click would pay a fresh
// TCP+TLS handshake to OpenRouter before any tokens flow. Hold idle
// connections for 60s so back-to-back clicks reuse the socket.
setGlobalDispatcher(
  new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000 }),
);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 8000);
// A rewritten prompt shouldn't run far longer than the original; this bounds
// worst-case generation time instead of letting the model ramble unchecked.
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS ?? 1024);

const SYSTEM_INSTRUCTION = [
  'You rewrite prompts that users are about to send to an AI assistant.',
  'Rewrite the given prompt to be clearer and more specific: state the goal',
  'explicitly, add missing context the author clearly implied, and structure',
  'the request so an assistant can act on it directly. Preserve the original',
  'intent, language, and any factual details exactly. Do not answer the',
  'prompt, do not add commentary, do not use quotes or markdown fences —',
  'respond with only the rewritten prompt text.',
].join(' ');

export type LlmErrorKind =
  | 'not_configured' // OPENROUTER_API_KEY missing
  | 'timeout' // request exceeded TIMEOUT_MS
  | 'upstream_rate_limited' // OpenRouter returned 429
  | 'upstream_error'; // any other OpenRouter failure

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface RewriteResult {
  improved: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown } }[];
}

/**
 * Best-effort: open a TLS connection to OpenRouter at server start so the
 * first Improve click doesn't pay the handshake. The kept-alive socket is
 * reused by the next rewrite call. Never throws.
 */
export async function warmUpConnection(): Promise<void> {
  try {
    await fetch('https://openrouter.ai/api/v1/models', {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Warmup is an optimization only — a real call will connect on demand.
  }
}

export async function rewritePrompt(text: string): Promise<RewriteResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new LlmError('not_configured', 'OPENROUTER_API_KEY is not set');
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Route to the fastest provider for this model instead of OpenRouter's
        // default price-balanced routing.
        provider: { sort: 'throughput' },
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new LlmError('timeout', `OpenRouter request exceeded ${TIMEOUT_MS}ms`);
    }
    throw new LlmError('upstream_error', 'OpenRouter request failed');
  }

  if (response.status === 429) {
    throw new LlmError('upstream_rate_limited', 'OpenRouter rate limit hit');
  }
  if (!response.ok) {
    // Body is not included: it could echo request headers on some errors.
    throw new LlmError(
      'upstream_error',
      `OpenRouter returned HTTP ${response.status}`,
    );
  }

  let content: unknown;
  try {
    const data = (await response.json()) as ChatCompletionResponse;
    content = data.choices?.[0]?.message?.content;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new LlmError('timeout', `OpenRouter request exceeded ${TIMEOUT_MS}ms`);
    }
    throw new LlmError('upstream_error', 'OpenRouter returned invalid JSON');
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new LlmError('upstream_error', 'OpenRouter returned no completion');
  }
  return { improved: content.trim() };
}
