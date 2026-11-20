import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env, refreshDbEnv } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let memoryServer = null;

export async function connectDB(overrideUri = '') {
  if (!env.isTest) {
    refreshDbEnv();
  }

  if (mongoose.connection.readyState === 1) {
    return {
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
      usingMemoryDb: Boolean(memoryServer),
    };
  }

  // Ephemeral RAM DB is ONLY used for isolated automated test suites (NODE_ENV=test)
  if (env.isTest || env.useMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const binaryDownloadDir = path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      binary: { downloadDir: binaryDownloadDir },
    });
    const memUri = memoryServer.getUri('ideaspark');
    await mongoose.connect(memUri);
    return {
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
      usingMemoryDb: true,
    };
  }

  const targetUri = overrideUri || env.mongoUri;
  if (!targetUri) {
    throw new Error('MONGO_URI is missing in backend/.env. Please configure your MongoDB Atlas connection string.');
  }

  try {
    await mongoose.connect(targetUri, {
      dbName: 'ideaspark',
      serverSelectionTimeoutMS: 15000,
    });

    return {
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
      usingMemoryDb: false,
    };
  } catch (error) {
    console.error(
      '\n[DB] Failed to connect to MongoDB Atlas cluster.\n' +
        ' -> Check your MONGO_URI credentials in backend/.env\n' +
        ' -> Ensure your IP address (or 0.0.0.0/0) is whitelisted in MongoDB Atlas -> Network Access\n'
    );
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: true, force: false });
    memoryServer = null;
  }
}
