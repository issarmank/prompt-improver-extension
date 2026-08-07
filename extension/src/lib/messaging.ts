// Typed chrome.runtime messaging between content script and service worker.

export type RewriteRequestMessage = {
  type: 'rewrite';
  text: string;
  siteId: string;
};

export type RewriteErrorKind =
  | 'rate_limited' // this install exhausted the backend's per-install budget (429)
  | 'llm_timeout' // the backend's LLM call timed out (504)
  | 'llm_rate_limited' // the LLM provider itself rate-limited the backend (502)
  | 'llm_not_configured' // backend has no API key (503)
  | 'llm_error' // the LLM provider returned a non-timeout, non-rate-limit failure (502)
  | 'invalid_request' // backend rejected the prompt or install id (400)
  | 'internal_error' // backend hit a bug or a dependency (e.g. Redis) failed (500)
  | 'network' // couldn't reach the backend at all
  | 'timeout' // backend didn't respond within the client timeout
  | 'server_error'; // anything else

export type RewriteResponse =
  | { ok: true; improved: string; remaining: number }
  | {
      ok: false;
      kind: RewriteErrorKind;
      message: string;
      retryAfterSeconds?: number;
    };

export function isRewriteRequest(msg: unknown): msg is RewriteRequestMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Partial<RewriteRequestMessage>;
  return m.type === 'rewrite' && typeof m.text === 'string';
}

export function requestRewrite(
  text: string,
  siteId: string,
): Promise<RewriteResponse> {
  const message: RewriteRequestMessage = { type: 'rewrite', text, siteId };
  return chrome.runtime.sendMessage(message);
}
