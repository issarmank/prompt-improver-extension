// Calls OpenRouter's chat completions API to rewrite a prompt.
// The API key is read from env at call time and must never appear in logs,
// error messages, or responses.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-v4-flash-0731';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 8000);

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
  } catch {
    throw new LlmError('upstream_error', 'OpenRouter returned invalid JSON');
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new LlmError('upstream_error', 'OpenRouter returned no completion');
  }
  return { improved: content.trim() };
}
