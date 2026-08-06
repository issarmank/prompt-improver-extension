// CORS locked to the extension's own origin. Browser requests from anywhere
// else (including other extensions) get a 403; requests without an Origin
// header (curl, health probes, server-to-server) pass through untouched
// because CORS only governs browsers.
import type { NextFunction, Request, Response } from 'express';

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, X-Install-Id';

/**
 * Reads the allowed origins from EXTENSION_ORIGIN — comma-separated so a dev
 * (unpacked) extension id can sit alongside the published one, e.g.
 * `chrome-extension://aaa...,chrome-extension://bbb...`.
 */
export function allowedOriginsFromEnv(): string[] {
  return (process.env.EXTENSION_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsForExtension(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.header('origin');
    if (!origin) {
      next();
      return;
    }

    if (!allowedOrigins.includes(origin)) {
      res.status(403).json({
        error: 'forbidden_origin',
        message: 'This origin is not allowed to call the rewrite service',
      });
      return;
    }

    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.set('Access-Control-Max-Age', '86400');
      res.sendStatus(204);
      return;
    }

    next();
  };
}
