import http from 'node:http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSocketServer } from './sockets/socketServer.js';
import { ensureCategories, seedDemoData } from './utils/seed.js';

async function startServer() {
  const dbInfo = await connectDB();
  console.log(
    `[DB] Connected (${dbInfo.usingMemoryDb ? 'In-Memory Test MongoDB' : `MongoDB Atlas: ${dbInfo.host}/${dbInfo.dbName}`})`
  );

  if (env.autoSeedDemo && !env.isProd) {
    await seedDemoData();
  } else {
    await ensureCategories();
  }

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`[IdeaSpark] Server & Socket.IO listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[IdeaSpark] ${signal} received. Closing server gracefully...`);
    httpServer.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('[IdeaSpark] Fatal startup error:', error);
  process.exit(1);
});

