import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.resolve(__dirname, '../../.env');

const initialNodeEnv = process.env.NODE_ENV;
dotenv.config({ path: envFilePath, override: true });
if (initialNodeEnv) {
  process.env.NODE_ENV = initialNodeEnv;
}

function cleanEnvValue(val = '') {
  return String(val).trim().replace(/^['"]|['"]$/g, '').trim();
}

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const nodeEnv = process.env.NODE_ENV || (isTest ? 'test' : 'development');
const isProd = !isTest && nodeEnv === 'production';

const devJwtFallback = crypto.createHash('sha256').update(`ideaspark-dev-jwt-${process.cwd()}`).digest('hex');
const devCsrfFallback = crypto.createHash('sha256').update(`ideaspark-dev-csrf-${process.cwd()}`).digest('hex');

const configuredJwtSecret = cleanEnvValue(process.env.JWT_SECRET);
const configuredCsrfSecret = cleanEnvValue(process.env.CSRF_SECRET);

if (isProd && (!configuredJwtSecret || !configuredCsrfSecret)) {
  throw new Error('JWT_SECRET and CSRF_SECRET are required in production.');
}

const mongoUri = cleanEnvValue(process.env.MONGO_URI);
if (!mongoUri && !isTest && process.env.USE_MEMORY_DB !== 'true') {
  throw new Error('MONGO_URI is required to connect to MongoDB.');
}
const defaultClientUrl = isProd ? 'https://ideaspark-pfwq.onrender.com' : 'http://localhost:5173';
const clientUrl = cleanEnvValue(process.env.CLIENT_URL) || cleanEnvValue(process.env.RENDER_EXTERNAL_URL) || defaultClientUrl;
const jwtSecret = configuredJwtSecret || devJwtFallback;
const csrfSecret = configuredCsrfSecret || devCsrfFallback;

export const env = {
  nodeEnv,
  isProd,
  isTest,
  port: Number(process.env.PORT || 5000),
  clientUrl,
  mongoUri,
  useMemoryDb: process.env.USE_MEMORY_DB === 'true',
  autoSeedDemo: process.env.AUTO_SEED_DEMO !== 'false',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  csrfSecret,
  cookieSecure: isProd ? true : process.env.COOKIE_SECURE === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'IdeaSpark Security <no-reply@ideaspark.local>',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  github: {
    clientId: cleanEnvValue(process.env.GITHUB_CLIENT_ID),
    clientSecret: cleanEnvValue(process.env.GITHUB_CLIENT_SECRET),
    callbackUrl: cleanEnvValue(
      process.env.GITHUB_CALLBACK_URL || `${clientUrl}/api/auth/github/callback`
    ),
  },
  google: {
    clientId: cleanEnvValue(process.env.GOOGLE_CLIENT_ID),
    clientSecret: cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET),
    callbackUrl: cleanEnvValue(
      process.env.GOOGLE_CALLBACK_URL || `${clientUrl}/api/auth/google/callback`
    ),
  },
  ai: {
    geminiApiKey: cleanEnvValue(process.env.GEMINI_API_KEY),
    openaiApiKey: cleanEnvValue(process.env.OPENAI_API_KEY),
  },
};

export function refreshAiEnv() {
  if (isTest || process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) return env;
  const currentEnv = process.env.NODE_ENV;
  dotenv.config({ path: envFilePath, override: true });
  if (currentEnv) process.env.NODE_ENV = currentEnv;
  env.ai.geminiApiKey = cleanEnvValue(process.env.GEMINI_API_KEY);
  env.ai.openaiApiKey = cleanEnvValue(process.env.OPENAI_API_KEY);
  return env;
}

export function refreshDbEnv() {
  if (isTest || process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) return env;
  const currentEnv = process.env.NODE_ENV;
  dotenv.config({ path: envFilePath, override: true });
  if (currentEnv) process.env.NODE_ENV = currentEnv;
  env.mongoUri = cleanEnvValue(process.env.MONGO_URI);
  env.useMemoryDb = cleanEnvValue(process.env.USE_MEMORY_DB) === 'true';
  if (!env.mongoUri && !env.useMemoryDb) {
    throw new Error('MONGO_URI is required to connect to MongoDB.');
  }
  env.autoSeedDemo = cleanEnvValue(process.env.AUTO_SEED_DEMO) !== 'false';
  return env;
}

export function refreshOAuthEnv() {
  if (isTest || process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) return env;
  const currentEnv = process.env.NODE_ENV;
  dotenv.config({ path: envFilePath, override: true });
  if (currentEnv) process.env.NODE_ENV = currentEnv;
  env.github.clientId = cleanEnvValue(process.env.GITHUB_CLIENT_ID);
  env.github.clientSecret = cleanEnvValue(process.env.GITHUB_CLIENT_SECRET);
  env.github.callbackUrl = cleanEnvValue(
    process.env.GITHUB_CALLBACK_URL || `${env.clientUrl}/api/auth/github/callback`
  );
  env.google.clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  env.google.clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  env.google.callbackUrl = cleanEnvValue(
    process.env.GOOGLE_CALLBACK_URL || `${env.clientUrl}/api/auth/google/callback`
  );
  return env;
}

