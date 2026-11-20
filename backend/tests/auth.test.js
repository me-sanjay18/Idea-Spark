import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import {
  clearTestDB,
  extractCsrfFromAgentResponse,
  registerAndAuthAgent,
  setupTestDB,
  teardownTestDB,
} from './helpers.js';

const app = createApp();

beforeAll(async () => {
  await setupTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe('Authentication, Cookies, CSRF & Security', () => {
  it('registers a user with HTTP-only JWT cookie, verifies email, and fetches /me', async () => {
    const { agent, csrfToken, registerRes, credentials } = await registerAndAuthAgent(app);

    expect(registerRes.status).toBe(201);
    const setCookies = registerRes.headers['set-cookie'].join('; ');
    expect(setCookies).toContain('ideaspark_token=');
    expect(setCookies).toContain('HttpOnly');
    expect(registerRes.body.data.user.passwordHash).toBeUndefined();

    const verifyToken = registerRes.body.data.devVerificationToken;
    const verifyRes = await agent
      .post('/api/auth/verify-email')
      .set('X-CSRF-Token', csrfToken)
      .send({ email: credentials.email, token: verifyToken });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.emailVerified).toBe(true);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(credentials.email);
  });

  it('blocks state-mutating authenticated requests missing a valid CSRF header', async () => {
    const { agent } = await registerAndAuthAgent(app);

    const noCsrfRes = await agent.patch('/api/users/me').send({ headline: 'Tampered headline' });
    expect(noCsrfRes.status).toBe(403);
    expect(noCsrfRes.body.code).toBe('CSRF_INVALID');
  });

  it('prevents NoSQL operator injection in login requests', async () => {
    await registerAndAuthAgent(app, {
      email: 'victim@example.com',
      username: 'victimuser',
    });

    const res = await supertest(app)
      .post('/api/auth/login')
      .send({
        identifier: { $gt: '' },
        password: 'anypassword',
      });

    expect(res.status).toBe(400);
  });

  it('completes password reset and invalidates old session tokens', async () => {
    const { agent: oldSessionAgent, credentials } = await registerAndAuthAgent(app);

    const forgotRes = await supertest(app)
      .post('/api/auth/forgot-password')
      .send({ email: credentials.email });

    expect(forgotRes.status).toBe(200);
    const resetToken = forgotRes.body.data.devResetToken;
    expect(resetToken).toBeTruthy();

    const resetAgent = supertest.agent(app);
    const resetRes = await resetAgent.post('/api/auth/reset-password').send({
      email: credentials.email,
      token: resetToken,
      password: 'NewStrongPassword99',
    });
    expect(resetRes.status).toBe(200);

    // Old session cookie should now be rejected because tokenVersion incremented
    const oldMe = await oldSessionAgent.get('/api/auth/me');
    expect(oldMe.status).toBe(401);

    // New password login succeeds
    const freshLogin = await supertest(app).post('/api/auth/login').send({
      identifier: credentials.email,
      password: 'NewStrongPassword99',
    });
    expect(freshLogin.status).toBe(200);
    expect(extractCsrfFromAgentResponse(freshLogin)).toBeTruthy();
  });

  it('supports Continue with Google OAuth 2.0 redirect, CSRF state check, and account sign-in', async () => {
    const prevId = env.google.clientId;
    const prevSecret = env.google.clientSecret;

    try {
      env.google.clientId = '';
      env.google.clientSecret = '';

      const unconfiguredRes = await supertest(app).get('/api/auth/google');
      expect(unconfiguredRes.status).toBe(302);
      expect(unconfiguredRes.headers.location).toContain('oauth=google_not_configured');

      env.google.clientId = 'test-google-client-id.apps.googleusercontent.com';
      env.google.clientSecret = 'test-google-client-secret';

      const oauthAgent = supertest.agent(app);
      const startRes = await oauthAgent.get('/api/auth/google');
      expect(startRes.status).toBe(302);
      expect(startRes.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');

      const redirectUrl = new URL(startRes.headers.location);
      const state = redirectUrl.searchParams.get('state');
      expect(state).toBeTruthy();

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('oauth2.googleapis.com/token')) {
          return {
            json: async () => ({ access_token: 'mock-google-access-token' }),
          };
        }
        return {
          json: async () => ({
            sub: 'google-uid-12345',
            email: 'google.builder@example.com',
            email_verified: true,
            name: 'Google Builder',
            picture: 'https://example.com/avatar.png',
          }),
        };
      });

      try {
        const callbackRes = await oauthAgent.get(
          `/api/auth/google/callback?code=mock-auth-code&state=${encodeURIComponent(state)}`
        );
        expect(callbackRes.status).toBe(302);
        expect(callbackRes.headers.location).toBe(`${env.clientUrl}/dashboard`);

        const meRes = await oauthAgent.get('/api/auth/me');
        expect(meRes.status).toBe(200);
        expect(meRes.body.data.user.email).toBe('google.builder@example.com');
        expect(meRes.body.data.user.emailVerified).toBe(true);

        const secRes = await oauthAgent.get('/api/users/me/security');
        expect(secRes.status).toBe(200);
        expect(secRes.body.data.googleConnected).toBe(true);
      } finally {
        fetchSpy.mockRestore();
      }
    } finally {
      env.google.clientId = prevId;
      env.google.clientSecret = prevSecret;
    }
  });
});

