// Validates the user/extension identifier on incoming requests.
import type { NextFunction, Request, Response } from 'express';

export const INSTALL_ID_HEADER = 'x-install-id';

// UUID-ish or similar opaque token: 8-128 chars of url-safe characters.
const INSTALL_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

declare module 'express-serve-static-core' {
  interface Request {
    installId?: string;
  }
}

export function requireInstallId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.header(INSTALL_ID_HEADER);
  if (!raw || !INSTALL_ID_PATTERN.test(raw)) {
    res.status(400).json({
      error: 'missing_install_id',
      message: `Requests must include a valid ${INSTALL_ID_HEADER} header`,
    });
    return;
  }
  req.installId = raw;
  next();
}
