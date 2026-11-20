import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'ideaspark_token';
export const CSRF_COOKIE_NAME = 'ideaspark_csrf';

export function signAuthToken(userId, role = 'user', tokenVersion = 0) {
  return jwt.sign(
    { sub: String(userId), role, tv: tokenVersion },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function generateCsrfToken() {
  const raw = crypto.randomBytes(24).toString('hex');
  const sig = crypto.createHmac('sha256', env.csrfSecret).update(raw).digest('hex');
  return `${raw}.${sig}`;
}

export function verifyCsrfSignature(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return false;
  }
  const [raw, sig] = token.split('.');
  if (!raw || !sig) return false;
  const expected = crypto.createHmac('sha256', env.csrfSecret).update(raw).digest('hex');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function generateRandomToken(bytes = 32) {
  const raw = crypto.randomBytes(bytes).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

export function hashIp(ip = '') {
  return crypto.createHash('sha256').update(`${ip}:${env.csrfSecret}`).digest('hex').slice(0, 24);
}

