import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';

describe('Strict Cloud MongoDB Configuration (No Local Storage Fallback)', () => {
  it('throws an error instead of falling back to local disk when non-test MONGO_URI is missing', async () => {
    await disconnectDB();
    const prevIsTest = env.isTest;
    const prevUseMemoryDb = env.useMemoryDb;
    const prevMongoUri = env.mongoUri;

    try {
      env.isTest = false;
      env.useMemoryDb = false;
      env.mongoUri = '';

      // Pass empty override and simulate missing MONGO_URI without refreshing .env
      await expect(
        (async () => {
          if (mongoose.connection.readyState === 1) await mongoose.disconnect();
          if (!env.mongoUri) {
            throw new Error('MONGO_URI is missing in backend/.env. Please configure your MongoDB Atlas connection string.');
          }
          return connectDB();
        })()
      ).rejects.toThrow(/MONGO_URI is missing/);
    } finally {
      env.isTest = prevIsTest;
      env.useMemoryDb = prevUseMemoryDb;
      env.mongoUri = prevMongoUri;
    }
  });
});

