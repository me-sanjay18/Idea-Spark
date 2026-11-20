import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath, override: true });

function cleanEnvValue(val = '') {
  return String(val).trim().replace(/^['"]|['"]$/g, '').trim();
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const defaultMongoUri = '';
const devJwtFallback = crypto.createHash('sha256').update(`ideaspark-dev-jwt-${process.cwd()}`).digest('hex');
const devCsrfFallback = crypto.createHash('sha256').update(`ideaspark-dev-csrf-${process.cwd()}`).digest('hex');

const mongoUri = cleanEnvValue(process.env.MONGO_URI) || defaultMongoUri;
const clientUrl = cleanEnvValue(process.env.CLIENT_URL) || cleanEnvValue(process.env.RENDER_EXTERNAL_URL) || 'http://localhost:5173';
const jwtSecret = cleanEnvValue(process.env.JWT_SECRET) || devJwtFallback;
const csrfSecret = cleanEnvValue(process.env.CSRF_SECRET) || devCsrfFallback;

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
  if (isTest) return env;
  dotenv.config({ path: envFilePath, override: true });
  env.ai.geminiApiKey = cleanEnvValue(process.env.GEMINI_API_KEY);
  env.ai.openaiApiKey = cleanEnvValue(process.env.OPENAI_API_KEY);
  return env;
}

export function refreshDbEnv() {
  if (isTest) return env;
  dotenv.config({ path: envFilePath, override: true });
  env.mongoUri = cleanEnvValue(process.env.MONGO_URI);
  env.useMemoryDb = cleanEnvValue(process.env.USE_MEMORY_DB) === 'true';
  env.autoSeedDemo = cleanEnvValue(process.env.AUTO_SEED_DEMO) !== 'false';
  return env;
}

export function refreshOAuthEnv() {
  if (isTest) return env;
  dotenv.config({ path: envFilePath, override: true });
  env.github.clientId = cleanEnvValue(process.env.GITHUB_CLIENT_ID);
  env.github.clientSecret = cleanEnvValue(process.env.GITHUB_CLIENT_SECRET);
  env.github.callbackUrl = cleanEnvValue(
    process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback'
  );
  env.google.clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  env.google.clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  env.google.callbackUrl = cleanEnvValue(
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  );
  return env;
}

