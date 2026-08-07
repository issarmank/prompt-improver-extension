// Background service worker: routes rewrite requests from content scripts
// through the backend client and maps failures to user-facing messages.
import { BackendError, rewrite } from '../lib/backend-client';
import {
  isRewriteRequest,
  type RewriteErrorKind,
  type RewriteResponse,
} from '../lib/messaging';

const ERROR_MESSAGES: Record<RewriteErrorKind, string> = {
  rate_limited: 'You’ve used up your hourly rewrite limit.',
  llm_timeout: 'The rewrite model took too long — try again.',
  llm_rate_limited: 'The rewrite model is overloaded right now — try again shortly.',
  llm_not_configured: 'The Prompt Polish backend has no API key configured.',
  llm_error: 'The rewrite model returned an error — try again.',
  invalid_request: 'The prompt was empty or too long to rewrite.',
  internal_error: 'Something went wrong on our end — try again.',
  network: 'Could not reach the Prompt Polish backend — is it running?',
  timeout: 'The backend took too long to respond — try again.',
  server_error: 'The Prompt Polish backend hit an unexpected error.',
};

export async function handleRewrite(text: string): Promise<RewriteResponse> {
  try {
    const { improved, remaining } = await rewrite(text);
    return { ok: true, improved, remaining };
  } catch (err) {
    if (err instanceof BackendError) {
      let message = ERROR_MESSAGES[err.kind];
      if (err.kind === 'rate_limited' && err.retryAfterSeconds) {
        message += ` Try again in ~${formatRetryAfter(err.retryAfterSeconds)}.`;
      }
      return {
        ok: false,
        kind: err.kind,
        message,
        retryAfterSeconds: err.retryAfterSeconds,
      };
    }
    return { ok: false, kind: 'server_error', message: ERROR_MESSAGES.server_error };
  }
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 90) return `${Math.ceil(seconds)}s`;
  return `${Math.ceil(seconds / 60)}min`;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRewriteRequest(message)) return;
  void handleRewrite(message.text).then(sendResponse);
  return true; // keep the message channel open for the async response
});
