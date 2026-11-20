import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clearTestDB, registerAndAuthAgent, setupTestDB, teardownTestDB } from './helpers.js';

const app = createApp();

beforeAll(async () => {
  await setupTestDB();
}, 35000);

beforeEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
}, 35000);

function buildIdeaPayload(overrides = {}) {
  return {
    title: 'Zero-Trust Edge Model Orchestrator',
    shortSummary: 'Privacy-preserving orchestration layer for hospital ML inference pipelines.',
    detailedDescription: 'CONFIDENTIAL ARCHITECTURE: Enclave key exchange protocol and custom tensor scheduler.',
    problemStatement: 'Hospitals struggle to deploy third-party diagnostic ML models without exposing patient data.',
    proposedSolution: 'PROPRIETARY SOLUTION: Hardware attestation gateway with zero-retention memory isolation.',
    category: 'AI & Machine Learning',
    requiredSkills: ['Rust', 'React', 'Security'],
    expectedDuration: '3 - 6 months',
    teamSize: 4,
    projectStage: 'prototype',
    visibility: 'public',
    protectDetailsWithNDA: false,
    ...overrides,
  };
}

describe('Idea Privacy Controls, Ownership Permissions & Confidentiality Gate', () => {
  it('never leaks private ideas in Explore feeds or direct API requests by unauthorized users', async () => {
    const owner = await registerAndAuthAgent(app);
    const outsider = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send(buildIdeaPayload({ visibility: 'private', title: 'Top Secret Stealth Idea' }));

    expect(createRes.status).toBe(201);
    const privateIdeaId = createRes.body.data.idea._id;
    expect(createRes.body.data.idea.ideaCode).toMatch(/^ISP-/);

    // 1. Public explore must NOT contain private idea
    const exploreRes = await supertest(app).get('/api/ideas?q=Stealth');
    expect(exploreRes.status).toBe(200);
    expect(exploreRes.body.data.ideas).toHaveLength(0);

    // 2. Direct API GET by unauthenticated visitor returns 403 and no idea payload
    const anonRes = await supertest(app).get(`/api/ideas/${privateIdeaId}`);
    expect(anonRes.status).toBe(403);
    expect(anonRes.body.data).toBeUndefined();
    expect(JSON.stringify(anonRes.body)).not.toContain('CONFIDENTIAL ARCHITECTURE');

    // 3. Direct API GET by another logged-in user returns 403
    const outsiderRes = await outsider.agent.get(`/api/ideas/${privateIdeaId}`);
    expect(outsiderRes.status).toBe(403);
    expect(JSON.stringify(outsiderRes.body)).not.toContain('Top Secret Stealth Idea');

    // 4. Owner CAN view full private idea
    const ownerView = await owner.agent.get(`/api/ideas/${privateIdeaId}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.data.idea.detailedDescription).toContain('CONFIDENTIAL ARCHITECTURE');
  });

  it('enforces unlisted shareToken access and hides unlisted ideas from public search', async () => {
    const owner = await registerAndAuthAgent(app);
    const viewer = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send(buildIdeaPayload({ visibility: 'unlisted', title: 'Unlisted Partner Concept' }));

    const idea = createRes.body.data.idea;
    expect(idea.shareToken).toBeTruthy();

    const exploreRes = await supertest(app).get('/api/ideas');
    expect(exploreRes.body.data.ideas).toHaveLength(0);

    const noTokenRes = await viewer.agent.get(`/api/ideas/${idea._id}`);
    expect(noTokenRes.status).toBe(403);

    const withTokenRes = await viewer.agent.get(`/api/ideas/${idea._id}?token=${idea.shareToken}`);
    expect(withTokenRes.status).toBe(200);
    expect(withTokenRes.body.data.idea.title).toBe('Unlisted Partner Concept');
  });

  it('redacts NDA-protected fields until Confidentiality Agreement is signed and audited', async () => {
    const owner = await registerAndAuthAgent(app);
    const builder = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send(buildIdeaPayload({ visibility: 'public', protectDetailsWithNDA: true }));

    const ideaId = createRes.body.data.idea._id;

    // Before signing NDA: public teaser visible, confidential fields strictly null
    const beforeNda = await builder.agent.get(`/api/ideas/${ideaId}`);
    expect(beforeNda.status).toBe(200);
    expect(beforeNda.body.data.idea.shortSummary).toBeTruthy();
    expect(beforeNda.body.data.idea.detailedDescription).toBeNull();
    expect(beforeNda.body.data.idea.proposedSolution).toBeNull();
    expect(beforeNda.body.data.idea.access.requiresNdaAcceptance).toBe(true);

    // Sign Confidentiality Agreement
    const signRes = await builder.agent
      .post(`/api/ideas/${ideaId}/nda`)
      .set('X-CSRF-Token', builder.csrfToken)
      .send({ signerFullName: builder.user.name, acknowledged: true });

    expect(signRes.status).toBe(200);
    expect(signRes.body.data.idea.detailedDescription).toContain('CONFIDENTIAL ARCHITECTURE');
    expect(signRes.body.data.idea.proposedSolution).toContain('PROPRIETARY SOLUTION');

    // Owner can audit signed agreements
    const recordsRes = await owner.agent.get(`/api/ideas/${ideaId}/records`);
    expect(recordsRes.status).toBe(200);
    expect(recordsRes.body.data.agreements).toHaveLength(1);
    expect(recordsRes.body.data.agreements[0].signerFullName).toBe(builder.user.name);
  });

  it('prevents non-owners from editing or deleting ideas and records edit/ownership history for owners', async () => {
    const owner = await registerAndAuthAgent(app);
    const attacker = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send(buildIdeaPayload());
    const ideaId = createRes.body.data.idea._id;

    const unauthorizedEdit = await attacker.agent
      .put(`/api/ideas/${ideaId}`)
      .set('X-CSRF-Token', attacker.csrfToken)
      .send({ title: 'Hijacked Title' });
    expect(unauthorizedEdit.status).toBe(403);

    const unauthorizedDelete = await attacker.agent
      .delete(`/api/ideas/${ideaId}`)
      .set('X-CSRF-Token', attacker.csrfToken);
    expect(unauthorizedDelete.status).toBe(403);

    const ownerEdit = await owner.agent
      .put(`/api/ideas/${ideaId}`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({ title: 'Refined Orchestrator v2', visibility: 'unlisted', editSummary: 'Moved to unlisted' });

    expect(ownerEdit.status).toBe(200);
    expect(ownerEdit.body.data.idea.editHistory).toHaveLength(1);
    expect(ownerEdit.body.data.idea.ownershipHistory.length).toBeGreaterThanOrEqual(2);
  });
});

