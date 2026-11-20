import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeRequest } from './middleware/sanitize.js';

import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import bookmarkRoutes from './routes/bookmarkRoutes.js';
import collaborationRoutes from './routes/collaborationRoutes.js';
import ideaRoutes from './routes/ideaRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userRoutes from './routes/userRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === env.clientUrl || (!env.isProd && /^http:\/\/localhost:\d+$/.test(origin))) {
          return callback(null, true);
        }
        return callback(new Error('Origin not permitted by CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
    })
  );

  if (!env.isTest) {
    app.use(morgan(env.isProd ? 'combined' : 'dev'));
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  // Serve validated local uploads with nosniff headers
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(path.resolve(__dirname, '../uploads'))
  );

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'IdeaSpark API Server',
      message: 'Backend API is running. Open the Frontend UI at http://localhost:5173',
      frontendUrl: env.clientUrl,
      healthEndpoint: '/api/health',
    });
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'ideaspark-api',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiLimiter, csrfProtection);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/ideas', ideaRoutes);
  app.use('/api/collaborations', collaborationRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/bookmarks', bookmarkRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

