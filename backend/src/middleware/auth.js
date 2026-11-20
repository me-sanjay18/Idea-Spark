import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/tokens.js';

async function resolveUserFromRequest(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded?.sub) return null;

  const user = await User.findById(decoded.sub).select('+tokenVersion');
  if (!user) return null;

  if ((user.tokenVersion || 0) !== (decoded.tv || 0)) {
    return null;
  }

  return user;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  let user = null;
  try {
    user = await resolveUserFromRequest(req);
  } catch {
    throw new AppError('Authentication session expired or invalid. Please log in again.', 401, 'UNAUTHORIZED');
  }

  if (!user) {
    throw new AppError('Authentication required. Please log in to continue.', 401, 'UNAUTHORIZED');
  }

  if (user.status === 'suspended') {
    throw new AppError(
      `Your account is currently suspended${user.suspensionReason ? `: ${user.suspensionReason}` : '.'}`,
      403,
      'ACCOUNT_SUSPENDED'
    );
  }

  if (user.status === 'banned') {
    throw new AppError('Your account has been permanently banned due to policy violations.', 403, 'ACCOUNT_BANNED');
  }

  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch {
    req.user = null;
  }
  next();
});

export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Administrator privileges are required to access this resource.', 403, 'FORBIDDEN_ADMIN'));
  }
  return next();
}

