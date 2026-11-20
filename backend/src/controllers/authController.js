import crypto from 'node:crypto';
import { z } from 'zod';
import { env, refreshOAuthEnv } from '../config/env.js';
import { setCsrfCookie } from '../middleware/csrf.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { recordAudit, recordSecurityEvent } from '../services/auditService.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';
import { createNotification } from '../services/notificationService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  generateRandomToken,
  getAuthCookieOptions,
  hashToken,
  signAuthToken,
} from '../utils/tokens.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(32)
    .regex(/^[a-z0-9_-]+$/, 'Username may only contain lowercase letters, numbers, underscores, and hyphens'),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
  headline: z.string().trim().max(140).optional().default(''),
  skills: z.array(z.string().trim().max(40)).max(20).optional().default([]),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(2, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
  token: z.string().min(16, 'Invalid reset token'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

function attachSessionCookies(res, user) {
  const jwtToken = signAuthToken(user._id, user.role, user.tokenVersion || 0);
  res.cookie(AUTH_COOKIE_NAME, jwtToken, getAuthCookieOptions());
  const csrfToken = setCsrfCookie(res);
  return csrfToken;
}

export const getCsrfToken = asyncHandler(async (_req, res) => {
  const csrfToken = setCsrfCookie(res);
  return sendSuccess(res, {
    message: 'CSRF token initialized',
    data: { csrfToken },
  });
});

export const register = asyncHandler(async (req, res) => {
  const { name, username, email, password, headline, skills } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const conflictField = existing.email === email ? 'email' : 'username';
    throw new AppError(`That ${conflictField} is already registered.`, 409, 'DUPLICATE_USER');
  }

  const passwordHash = await User.hashPassword(password);
  const { raw: rawVerifyToken, hash: verifyHash } = generateRandomToken(32);

  const user = await User.create({
    name,
    username,
    email,
    passwordHash,
    headline,
    skills,
    emailVerified: false,
    emailVerificationTokenHash: verifyHash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastLoginAt: new Date(),
  });

  const emailInfo = await sendVerificationEmail(user, rawVerifyToken);
  const csrfToken = attachSessionCookies(res, user);

  await recordSecurityEvent(user._id, 'Account registered', req);
  await recordAudit({
    actor: user._id,
    action: 'USER_REGISTERED',
    entityType: 'auth',
    entityId: user._id,
    summary: `New user @${user.username} registered`,
    ip: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created! Please verify your email address.',
    data: {
      user,
      csrfToken,
      ...(env.isProd ? {} : { devVerificationToken: rawVerifyToken, devVerifyUrl: emailInfo.verifyUrl }),
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const normalized = identifier.toLowerCase().trim();

  const user = await User.findOne({
    $or: [{ email: normalized }, { username: normalized }],
  }).select('+passwordHash +tokenVersion');

  if (!user || !user.passwordHash) {
    throw new AppError('Invalid credentials. Please check your email/username and password.', 401, 'INVALID_CREDENTIALS');
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    await recordSecurityEvent(user._id, 'Failed login attempt', req);
    throw new AppError('Invalid credentials. Please check your email/username and password.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'suspended') {
    throw new AppError(
      `Your account is currently suspended${user.suspensionReason ? `: ${user.suspensionReason}` : '.'}`,
      403,
      'ACCOUNT_SUSPENDED'
    );
  }

  if (user.status === 'banned') {
    throw new AppError('Your account has been banned.', 403, 'ACCOUNT_BANNED');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const csrfToken = attachSessionCookies(res, user);
  await recordSecurityEvent(user._id, 'Signed in with password', req);

  return sendSuccess(res, {
    message: 'Signed in successfully',
    data: { user, csrfToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  if (req.user) {
    await recordSecurityEvent(req.user._id, 'Signed out', req);
  }
  return sendSuccess(res, { message: 'Logged out safely' });
});

export const getMe = asyncHandler(async (req, res) => {
  const csrfToken = req.cookies?.[CSRF_COOKIE_NAME] || setCsrfCookie(res);
  const unreadNotifications = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  const userConvIds = await Conversation.find({ participants: req.user._id }).distinct('_id');
  const unreadMessages = userConvIds.length
    ? await Message.countDocuments({
        conversation: { $in: userConvIds },
        sender: { $ne: req.user._id },
        'readBy.user': { $ne: req.user._id },
      })
    : 0;

  return sendSuccess(res, {
    data: {
      user: req.user,
      csrfToken,
      unreadNotifications,
      unreadMessages,
    },
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token, email } = req.body;
  if (!token || !email) {
    throw new AppError('Verification token and email are required.', 400, 'MISSING_TOKEN');
  }

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    email: String(email).toLowerCase().trim(),
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires +tokenVersion');

  if (!user) {
    throw new AppError('Invalid or expired verification link. Please request a new one.', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  await recordSecurityEvent(user._id, 'Email address verified', req);
  await createNotification({
    recipient: user._id,
    type: 'security_alert',
    title: 'Email Verified',
    body: 'Your email address has been verified. Full collaboration features are active.',
    link: '/dashboard',
  });

  return sendSuccess(res, {
    message: 'Email verified successfully!',
    data: { user },
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+emailVerificationTokenHash +emailVerificationExpires');
  if (user.emailVerified) {
    return sendSuccess(res, { message: 'Your email is already verified.' });
  }

  const { raw, hash } = generateRandomToken(32);
  user.emailVerificationTokenHash = hash;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const emailInfo = await sendVerificationEmail(user, raw);

  return sendSuccess(res, {
    message: 'A fresh verification link has been sent to your email.',
    data: env.isProd ? {} : { devVerificationToken: raw, devVerifyUrl: emailInfo.verifyUrl },
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select('+resetPasswordTokenHash +resetPasswordExpires');

  let devPayload = {};
  if (user && user.status === 'active') {
    const { raw, hash } = generateRandomToken(32);
    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const emailInfo = await sendPasswordResetEmail(user, raw);
    await recordSecurityEvent(user._id, 'Password reset link requested', req);
    if (!env.isProd) {
      devPayload = { devResetToken: raw, devResetUrl: emailInfo.resetUrl };
    }
  }

  return sendSuccess(res, {
    message: 'If an account matches that email, a password reset link has been sent.',
    data: devPayload,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    email,
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+passwordHash +resetPasswordTokenHash +resetPasswordExpires +tokenVersion');

  if (!user) {
    throw new AppError('Reset link is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await User.hashPassword(password);
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await recordSecurityEvent(user._id, 'Password reset completed', req);
  await createNotification({
    recipient: user._id,
    type: 'security_alert',
    title: 'Password Changed',
    body: 'Your account password was recently reset. If this was not you, contact support immediately.',
    link: '/settings/security',
  });

  const csrfToken = attachSessionCookies(res, user);

  return sendSuccess(res, {
    message: 'Your password has been updated and you are now signed in.',
    data: { user, csrfToken },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');

  if (user.passwordHash) {
    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      throw new AppError('Your current password is incorrect.', 400, 'INVALID_PASSWORD');
    }
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const csrfToken = attachSessionCookies(res, user);
  await recordSecurityEvent(user._id, 'Password updated from settings', req);
  await createNotification({
    recipient: user._id,
    type: 'security_alert',
    title: 'Security Alert: Password Updated',
    body: 'Your password was updated and all other active sessions were signed out.',
    link: '/settings/security',
  });

  return sendSuccess(res, {
    message: 'Password updated successfully.',
    data: { csrfToken },
  });
});

export const githubAuthStart = asyncHandler(async (_req, res) => {
  refreshOAuthEnv();
  if (!env.github.clientId || !env.github.clientSecret) {
    return res.redirect(`${env.clientUrl}/login?oauth=github_not_configured`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('ideaspark_gh_state', state, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: env.github.clientId,
    redirect_uri: env.github.callbackUrl,
    scope: 'read:user user:email',
    state,
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

export const githubAuthCallback = asyncHandler(async (req, res) => {
  refreshOAuthEnv();
  const { code, state } = req.query;
  const savedState = req.cookies?.ideaspark_gh_state;
  res.clearCookie('ideaspark_gh_state', { path: '/' });

  if (!code || !state || !savedState || state !== savedState) {
    return res.redirect(`${env.clientUrl}/login?oauth=state_mismatch`);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'IdeaSpark-App',
      },
      body: JSON.stringify({
        client_id: env.github.clientId,
        client_secret: env.github.clientSecret,
        code,
        redirect_uri: env.github.callbackUrl,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${env.clientUrl}/login?oauth=failed`);
    }

    const ghHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'IdeaSpark-App',
    };

    const [profileRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers: ghHeaders }),
      fetch('https://api.github.com/user/emails', { headers: ghHeaders }),
    ]);

    const ghUser = await profileRes.json();
    const ghEmails = await emailsRes.json();
    const primaryEmailObj = Array.isArray(ghEmails)
      ? ghEmails.find((e) => e.primary && e.verified) || ghEmails[0]
      : null;
    const email = (primaryEmailObj?.email || ghUser.email || '').toLowerCase();

    if (!email) {
      return res.redirect(`${env.clientUrl}/login?oauth=email_required`);
    }

    let user = await User.findOne({ $or: [{ githubId: String(ghUser.id) }, { email }] }).select('+tokenVersion');
    if (!user) {
      const baseUsername = String(ghUser.login || 'builder')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24);
      const uniqueUsername = `${baseUsername || 'user'}-${crypto.randomBytes(2).toString('hex')}`;

      user = await User.create({
        name: ghUser.name || ghUser.login || 'GitHub Innovator',
        username: uniqueUsername,
        email,
        githubId: String(ghUser.id),
        emailVerified: true,
        avatarUrl: ghUser.avatar_url || '',
        bio: ghUser.bio || '',
        socialLinks: { github: ghUser.html_url || '' },
        lastLoginAt: new Date(),
      });
    } else {
      if (!user.githubId) user.githubId = String(ghUser.id);
      if (!user.avatarUrl && ghUser.avatar_url) user.avatarUrl = ghUser.avatar_url;
      user.emailVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (user.status !== 'active') {
      return res.redirect(`${env.clientUrl}/login?oauth=account_restricted`);
    }

    attachSessionCookies(res, user);
    await recordSecurityEvent(user._id, 'Signed in via GitHub OAuth', req);
    return res.redirect(`${env.clientUrl}/dashboard`);
  } catch {
    return res.redirect(`${env.clientUrl}/login?oauth=error`);
  }
});

export const googleAuthStart = asyncHandler(async (_req, res) => {
  refreshOAuthEnv();
  if (!env.google.clientId || !env.google.clientSecret) {
    return res.redirect(`${env.clientUrl}/login?oauth=google_not_configured`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('ideaspark_google_state', state, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

export const googleAuthCallback = asyncHandler(async (req, res) => {
  refreshOAuthEnv();
  const { code, state, error } = req.query;
  const savedState = req.cookies?.ideaspark_google_state;
  res.clearCookie('ideaspark_google_state', { path: '/' });

  if (error) {
    return res.redirect(`${env.clientUrl}/login?oauth=google_cancelled`);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return res.redirect(`${env.clientUrl}/login?oauth=state_mismatch`);
  }

  try {
    const tokenBody = new URLSearchParams({
      code: String(code),
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: env.google.callbackUrl,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenBody.toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${env.clientUrl}/login?oauth=failed`);
    }

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });
    const googleUser = await profileRes.json();
    const googleSub = googleUser?.sub ? String(googleUser.sub) : '';
    const email = String(googleUser?.email || '').toLowerCase().trim();

    if (!googleSub || !email || googleUser.email_verified === false) {
      return res.redirect(`${env.clientUrl}/login?oauth=email_required`);
    }

    let user = await User.findOne({ $or: [{ googleId: googleSub }, { email }] }).select('+tokenVersion');
    if (!user) {
      const emailPrefix = email.split('@')[0] || 'builder';
      const baseUsername = emailPrefix
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24);
      const uniqueUsername = `${baseUsername.length >= 3 ? baseUsername : 'builder'}-${crypto.randomBytes(2).toString('hex')}`;

      user = await User.create({
        name: String(googleUser.name || emailPrefix || 'Google Innovator').slice(0, 80),
        username: uniqueUsername,
        email,
        googleId: googleSub,
        emailVerified: true,
        avatarUrl: googleUser.picture || '',
        lastLoginAt: new Date(),
      });

      await recordAudit({
        actor: user._id,
        action: 'USER_REGISTERED',
        entityType: 'auth',
        entityId: user._id,
        summary: `New user @${user.username} registered via Google OAuth`,
        ip: req.ip,
      });
    } else {
      if (!user.googleId) user.googleId = googleSub;
      if (!user.avatarUrl && googleUser.picture) user.avatarUrl = googleUser.picture;
      user.emailVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (user.status !== 'active') {
      return res.redirect(`${env.clientUrl}/login?oauth=account_restricted`);
    }

    attachSessionCookies(res, user);
    await recordSecurityEvent(user._id, 'Signed in via Google OAuth', req);
    return res.redirect(`${env.clientUrl}/dashboard`);
  } catch {
    return res.redirect(`${env.clientUrl}/login?oauth=error`);
  }
});

