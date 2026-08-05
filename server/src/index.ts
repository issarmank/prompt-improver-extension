// Express app entry.
import express from 'express';
import type { Redis } from 'ioredis';
import { warmUpConnection } from './lib/llm.js';
import { createRateLimiter } from './lib/rate-limiter.js';
import { createRedisClient } from './lib/redis.js';
import { createRewriteRouter } from './routes/rewrite.js';

export function createApp(redis: Redis): express.Express {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(createRewriteRouter(createRateLimiter(redis)));
  return app;
}

const isDirectRun = process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  const port = Number(process.env.PORT ?? 8787);
  const app = createApp(createRedisClient());
  void warmUpConnection();
  app.listen(port, () => {
    console.log(`prompt-polish server listening on http://localhost:${port}`);
  });
}
