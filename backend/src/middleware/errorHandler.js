import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected server error occurred';
  let details = err.details || null;

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds maximum allowed size.';
    }
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = details[0]?.message || 'Validation failed';
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_VALUE';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account or record with this ${field} already exists.`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier format for ${err.path}.`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Invalid or expired authentication token.';
  }

  if (statusCode >= 500 && !env.isTest) {
    console.error('[ERROR]', err);
  }

  const response = {
    success: false,
    code,
    message: statusCode >= 500 && env.isProd ? 'Internal server error' : message,
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

