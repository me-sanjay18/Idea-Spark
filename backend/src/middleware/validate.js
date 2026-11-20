import { AppError } from '../utils/AppError.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError(details[0]?.message || 'Invalid request data', 400, 'VALIDATION_ERROR', details));
    }
    req.body = parsed.data;
    return next();
  };
}

