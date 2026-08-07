// Client for the Prompt Polish backend (POST /rewrite).
import type { RewriteErrorKind } from './messaging';

// Baked in at build time from VITE_BACKEND_URL (see extension/.env.production).
// Falls back to the docker-compose dev server so `npm run dev` needs no setup.
export const DEFAULT_BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787';
export const REWRITE_TIMEOUT_MS = 8000;

const INSTALL_ID_KEY = 'installId';

export class BackendError extends Error {
  constructor(
    public readonly kind: RewriteErrorKind,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

/**
 * Returns this install's stable anonymous id, generating and persisting one
 * in chrome.storage.local on first use. The backend rate-limits per install id.
 */
export async function getOrCreateInstallId(): Promise<string> {
  const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
  const existing = stored[INSTALL_ID_KEY];
  if (typeof existing === 'string' && existing.length > 0) return existing;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALL_ID_KEY]: id });
  return id;
}

export type BackendRewriteResult = { improved: string; remaining: number };

export async function rewrite(
  text: string,
  baseUrl: string = DEFAULT_BACKEND_URL,
): Promise<BackendRewriteResult> {
  const installId = await getOrCreateInstallId();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Install-Id': installId,
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new BackendError(
        'timeout',
        `Backend did not respond within ${REWRITE_TIMEOUT_MS}ms`,
      );
    }
    throw new BackendError('network', 'Could not reach the backend');
  }

  if (!res.ok) throw await toBackendError(res);

  const body = (await res.json().catch(() => null)) as {
    improved?: unknown;
    remaining?: unknown;
  } | null;
  if (!body || typeof body.improved !== 'string') {
    throw new BackendError('server_error', 'Backend returned an invalid response');
  }
  return {
    improved: body.improved,
    remaining: typeof body.remaining === 'number' ? body.remaining : 0,
  };
}

async function toBackendError(res: Response): Promise<BackendError> {
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    retryAfterSeconds?: unknown;
  } | null;
  const code = typeof body?.error === 'string' ? body.error : '';

  if (res.status === 429) {
    const header = Number(res.headers.get('Retry-After'));
    const retryAfterSeconds = Number.isFinite(header)
      ? header
      : typeof body?.retryAfterSeconds === 'number'
        ? body.retryAfterSeconds
        : undefined;
    return new BackendError(
      'rate_limited',
      'Rewrite limit reached for this install',
      retryAfterSeconds,
    );
  }

  switch (code) {
    case 'llm_timeout':
      return new BackendError('llm_timeout', 'The rewrite model timed out');
    case 'llm_rate_limited':
      return new BackendError(
        'llm_rate_limited',
        'The rewrite model is rate-limiting the backend',
      );
    case 'llm_not_configured':
      return new BackendError(
        'llm_not_configured',
        'The backend has no LLM API key configured',
      );
    case 'llm_error':
      return new BackendError('llm_error', 'The rewrite model returned an error');
    case 'invalid_body':
    case 'missing_install_id':
      return new BackendError('invalid_request', `Backend rejected the request (${code})`);
    case 'internal_error':
      return new BackendError('internal_error', 'The backend hit an internal error');
    default:
      return new BackendError(
        'server_error',
        `Backend returned an unexpected error (HTTP ${res.status})`,
      );
  }
}
