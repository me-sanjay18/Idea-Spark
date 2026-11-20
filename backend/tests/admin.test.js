import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
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

describe('Admin Role-Based Access Control & Moderation', () => {
  it('blocks non-admin users from accessing admin endpoints and prevents frontend role spoofing', async () => {
    const regular = await registerAndAuthAgent(app);

    // Attempt to spoof role via profile update
    await regular.agent
      .patch('/api/users/me')
      .set('X-CSRF-Token', regular.csrfToken)
      .send({ name: 'Spoofer', role: 'admin' });

    const meRes = await regular.agent.get('/api/auth/me');
    expect(meRes.body.data.user.role).toBe('user');

    const adminOverview = await regular.agent.get('/api/admin/overview');
    expect(adminOverview.status).toBe(403);
    expect(adminOverview.body.code).toBe('FORBIDDEN_ADMIN');
  });

  it('allows authorized administrators to review reports, remove violating ideas, suspend abusive users, and manage categories', async () => {
    const adminSetup = await registerAndAuthAgent(app, { username: 'sysadmin', email: 'sysadmin@example.com' });
    await User.findByIdAndUpdate(adminSetup.user._id, { $set: { role: 'admin' } });
    const adminLogin = await adminSetup.agent.post('/api/auth/login').send({
      identifier: 'sysadmin@example.com',
      password: adminSetup.credentials.password,
    });
    const adminCsrf = extractCsrfFromAgentResponse(adminLogin);

    const reporter = await registerAndAuthAgent(app);
    const badActor = await registerAndAuthAgent(app);

    const badIdeaRes = await badActor.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', badActor.csrfToken)
      .send({
        title: 'Copied Proprietary Pitch Deck Idea',
        shortSummary: 'Blatantly copied idea description from another founder.',
        detailedDescription: 'Full copied specification without authorization or credit.',
        problemStatement: 'Copied problem statement text.',
        proposedSolution: 'Copied proposed solution text.',
        category: 'SaaS & Productivity',
      });
    const badIdeaId = badIdeaRes.body.data.idea._id;

    // Reporter files a report
    const reportRes = await reporter.agent
      .post('/api/reports')
      .set('X-CSRF-Token', reporter.csrfToken)
      .send({
        targetType: 'idea',
        targetIdeaId: badIdeaId,
        reason: 'stolen_or_copied',
        description: 'This user copied our confidential hackathon architecture word-for-word.',
      });
    expect(reportRes.status).toBe(201);
    const reportId = reportRes.body.data.report._id;

    // Admin reviews overview
    const overviewRes = await adminSetup.agent.get('/api/admin/overview');
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.stats.openReports).toBe(1);

    // Admin resolves report with idea removal
    const reviewRes = await adminSetup.agent
      .patch(`/api/admin/reports/${reportId}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        status: 'resolved',
        actionTaken: 'idea_removed',
        resolutionNote: 'Confirmed unauthorized copy; content removed.',
      });
    expect(reviewRes.status).toBe(200);

    // Removed idea is no longer accessible
    const checkRemoved = await reporter.agent.get(`/api/ideas/${badIdeaId}`);
    expect(checkRemoved.status).toBe(404);

    // Admin suspends badActor -> badActor's active session is immediately revoked
    const suspendRes = await adminSetup.agent
      .patch(`/api/admin/users/${badActor.user._id}/status`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ status: 'suspended', reason: 'Repeated IP plagiarism' });
    expect(suspendRes.status).toBe(200);

    const badActorMe = await badActor.agent.get('/api/auth/me');
    expect([401, 403]).toContain(badActorMe.status);

    // Admin creates a category
    const catRes = await adminSetup.agent
      .post('/api/admin/categories')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Robotics & Hardware', description: 'Embedded systems and autonomous robotics.' });
    expect(catRes.status).toBe(201);
  });
});

