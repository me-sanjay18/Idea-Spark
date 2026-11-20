import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = 'true';
process.env.AUTO_SEED_DEMO = 'false';

let mongod = null;

export async function setupTestDB() {
  mongod = await MongoMemoryServer.create({
    binary: {
      downloadDir: './node_modules/.cache/mongodb-memory-server',
    },
  });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function teardownTestDB() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export function extractCsrfFromAgentResponse(res) {
  const csrfFromBody = res.body?.data?.csrfToken;
  if (csrfFromBody) return csrfFromBody;

  const setCookie = res.headers?.['set-cookie'] || [];
  for (const cookieStr of setCookie) {
    if (cookieStr.startsWith('ideaspark_csrf=')) {
      return decodeURIComponent(cookieStr.split(';')[0].split('=')[1]);
    }
  }
  return '';
}

export async function registerAndAuthAgent(app, overrides = {}) {
  const agent = supertest.agent(app);
  const suffix = Math.random().toString(36).slice(2, 8);
  const payload = {
    name: overrides.name || `Builder ${suffix}`,
    username: overrides.username || `builder_${suffix}`,
    email: overrides.email || `builder_${suffix}@example.com`,
    password: overrides.password || 'SecurePass123',
    headline: overrides.headline || 'Full-Stack Innovator',
    skills: overrides.skills || ['React', 'Node.js'],
  };

  const res = await agent.post('/api/auth/register').send(payload);
  const csrfToken = extractCsrfFromAgentResponse(res);
  return { agent, csrfToken, user: res.body?.data?.user, registerRes: res, credentials: payload };
}
