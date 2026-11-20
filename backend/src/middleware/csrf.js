import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  verifyCsrfSignature,
} from '../utils/tokens.js';

export function setCsrfCookie(res) {
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: env.isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return csrfToken;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
]);

export function csrfProtection(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    setCsrfCookie(res);
  }

  if (SAFE_METHODS.has(req.method) || PUBLIC_AUTH_PATHS.has(req.path)) {
    return next();
  }

  // Enforce CSRF check whenever an authenticated session cookie is attached
  if (!req.cookies?.[AUTH_COOKIE_NAME]) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken !== headerToken ||
    !verifyCsrfSignature(headerToken)
  ) {
    return next(new AppError('Invalid or missing CSRF security token. Please refresh and try again.', 403, 'CSRF_INVALID'));
  }

  return next();
}
