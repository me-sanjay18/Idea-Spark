function stripDangerousText(str) {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|svg|math|link|meta|style)\b[^>]*>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function cleanValue(val) {
  if (typeof val === 'string') {
    return stripDangerousText(val);
  }
  if (Array.isArray(val)) {
    return val.map(cleanValue);
  }
  if (val && typeof val === 'object' && !(val instanceof Date)) {
    const cleaned = {};
    for (const [key, nested] of Object.entries(val)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      cleaned[key] = cleanValue(nested);
    }
    return cleaned;
  }
  return val;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const cleanedQuery = cleanValue(req.query);
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, cleanedQuery);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = cleanValue(req.params);
  }
  next();
}

