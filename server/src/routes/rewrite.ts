// POST /rewrite endpoint.
import { Router } from 'express';
import type { RateLimiterRedis } from 'rate-limiter-flexible';
import { LlmError, rewritePrompt } from '../lib/llm.js';
import { consume } from '../lib/rate-limiter.js';
import { requireInstallId } from '../middleware/auth.js';

const MAX_PROMPT_LENGTH = 8000;

// Distinct from the rate limiter's 429: upstream failures surface as 5xx so
// the extension can tell "slow down" apart from "the rewrite service broke".
function mapLlmError(kind: LlmError['kind']): { status: number; error: string } {
  switch (kind) {
    case 'timeout':
      return { status: 504, error: 'llm_timeout' };
    case 'upstream_rate_limited':
      return { status: 502, error: 'llm_rate_limited' };
    case 'not_configured':
      return { status: 503, error: 'llm_not_configured' };
    default:
      return { status: 502, error: 'llm_error' };
  }
}

export function createRewriteRouter(limiter: RateLimiterRedis): Router {
  const router = Router();

  router.post('/rewrite', requireInstallId, async (req, res) => {
    const text = (req.body as { text?: unknown } | undefined)?.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({
        error: 'invalid_body',
        message: 'Body must be JSON with a non-empty "text" string',
      });
      return;
    }
    if (text.length > MAX_PROMPT_LENGTH) {
      res.status(400).json({
        error: 'invalid_body',
        message: `"text" must be at most ${MAX_PROMPT_LENGTH} characters`,
      });
      return;
    }

    try {
      const result = await consume(limiter, req.installId!);
      if (!result.allowed) {
        res
          .status(429)
          .set('Retry-After', String(result.retryAfterSeconds))
          .json({
            error: 'rate_limited',
            message: 'Too many requests, try again later',
            retryAfterSeconds: result.retryAfterSeconds,
          });
        return;
      }

      const { improved } = await rewritePrompt(text);
      res.json({ improved, remaining: result.remaining });
    } catch (err) {
      if (err instanceof LlmError) {
        // LlmError messages are written by us and never contain the API key.
        console.error(`rewrite upstream failure (${err.kind}): ${err.message}`);
        const { status, error } = mapLlmError(err.kind);
        res.status(status).json({ error, message: err.message });
        return;
      }
      console.error('rewrite failed:', err);
      res.status(500).json({
        error: 'internal_error',
        message: 'Rewrite failed, try again later',
      });
    }
  });

  return router;
}
