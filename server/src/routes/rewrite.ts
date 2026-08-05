// POST /rewrite endpoint.
import { Router } from 'express';
import type { RateLimiterRedis } from 'rate-limiter-flexible';
import { rewritePrompt } from '../lib/llm.js';
import { consume } from '../lib/rate-limiter.js';
import { requireInstallId } from '../middleware/auth.js';

const MAX_PROMPT_LENGTH = 8000;

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
      console.error('rewrite failed:', err);
      res.status(500).json({
        error: 'internal_error',
        message: 'Rewrite failed, try again later',
      });
    }
  });

  return router;
}
