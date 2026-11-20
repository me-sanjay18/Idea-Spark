import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max: env.isTest ? max * 100 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMITED',
      message,
    },
  });
}

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP. Please slow down and try again shortly.',
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login or registration attempts. Please wait 15 minutes before trying again.',
});

export const passwordResetLimiter = createLimiter({
  windowMs: 30 * 60 * 1000,
  max: 8,
  message: 'Too many password reset requests. Please check your inbox or try again later.',
});

export const sensitiveWriteLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: 'Rate limit reached for sensitive actions. Please wait a few minutes.',
});

