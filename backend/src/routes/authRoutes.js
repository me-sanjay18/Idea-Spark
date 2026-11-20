import { Router } from 'express';
import {
  changePassword,
  changePasswordSchema,
  forgotPassword,
  forgotPasswordSchema,
  getCsrfToken,
  getMe,
  githubAuthCallback,
  githubAuthStart,
  googleAuthCallback,
  googleAuthStart,
  login,
  loginSchema,
  logout,
  register,
  registerSchema,
  resendVerification,
  resetPassword,
  resetPasswordSchema,
  verifyEmail,
} from '../controllers/authController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.get('/csrf-token', getCsrfToken);
router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/logout', optionalAuth, logout);
router.get('/me', authenticate, getMe);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authenticate, authLimiter, resendVerification);
router.post('/forgot-password', passwordResetLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validateBody(resetPasswordSchema), resetPassword);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), changePassword);

router.get('/github', githubAuthStart);
router.get('/github/callback', githubAuthCallback);
router.get('/google', googleAuthStart);
router.get('/google/callback', googleAuthCallback);

export default router;

