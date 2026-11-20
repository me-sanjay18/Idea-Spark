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

describe('Enhanced Idea Form & Specifications Engine', () => {
  it('persists all Section 1, 2, 3, and 4 fields, dynamic arrays, and custom roles', async () => {
    const owner = await registerAndAuthAgent(app);

    const payload = {
      title: 'NeuroVision — Edge Vision Copilot for Agriculture',
      shortSummary: 'High-throughput computer vision edge node detecting early crop blights on field tractors.',
      problemStatement: 'Farmers lose up to 30% of yields due to fungal blights detected too late by manual inspections.',
      targetAudience: 'Commercial crop growers and tractor fleet operators',
      industryDomain: 'Agriculture & AgriTech',
      existingAlternatives: 'Periodic drone flyovers and manual crop scouting twice a month',
      marketOpportunity: '15,000 commercial farms in the Midwest transitioning to autonomous tractors',

      proposedSolution: 'On-chassis ruggedized edge cameras running quantized PyTorch models in real time.',
      detailedDescription: 'Full pipeline architecture: camera sensor stream -> edge NPU -> offline SQLite event cache -> cellular sync.',
      uniqueSellingProposition: 'Sub-50ms inference on tractor battery power with zero cloud connectivity dependency.',
      keyFeatures: [
        { title: 'Offline Blight Inference', description: 'Quantized neural net running locally on tractor NPU' },
        { title: 'GPS Blight Heatmap', description: 'Pins coordinates of diseased plants for spot pesticide application' },
      ],
      expectedOutcome: '95% reduction in crop loss and 70% decrease in overall pesticide usage',
      successMetrics: '98% recall on common blight molds with under 2W power draw',
      referenceLinks: [
        { title: 'AgriTech Report 2026', url: 'https://example.com/agritech-report' },
      ],

      category: 'AI & Machine Learning',
      requiredSkills: ['PyTorch', 'Rust', 'Embedded Linux'],
      requiredRoles: ['AI/ML Engineer', 'Full-Stack Developer', 'Embedded Systems Specialist'],
      expectedDuration: '3 - 6 months',
      teamSize: 4,
      projectStage: 'prototype',
      collaborationType: 'startup',
      workArrangement: 'hybrid',
      weeklyCommitment: '10-20',
      compensationModel: 'equity',
      collaborationRequirements: 'Weekly sprint on Tuesdays, code reviews via GitHub, access to test farm in summer.',

      visibility: 'public',
      protectDetailsWithNDA: true,
      allowCollaborationRequests: true,
      requireOwnerApproval: true,
      maxCollaborators: 4,
    };

    const res = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send(payload);

    expect(res.status).toBe(201);
    const idea = res.body.data.idea;
    expect(idea.title).toBe(payload.title);
    expect(idea.industryDomain).toBe('Agriculture & AgriTech');
    expect(idea.targetAudience).toBe('Commercial crop growers and tractor fleet operators');
    expect(idea.keyFeatures).toHaveLength(2);
    expect(idea.keyFeatures[0].title).toBe('Offline Blight Inference');
    expect(idea.requiredRoles).toContain('Embedded Systems Specialist');
    expect(idea.collaborationType).toBe('startup');
    expect(idea.compensationModel).toBe('equity');
    expect(idea.version).toBe(1);
  });

  it('supports saving incomplete drafts, hides drafts from Explore, and allows publishing later', async () => {
    const owner = await registerAndAuthAgent(app);
    const visitor = await registerAndAuthAgent(app);

    // Save incomplete draft with very short title and no description
    const draftRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send({
        status: 'draft',
        title: 'Draft',
        category: 'Developer Tools',
        visibility: 'public',
      });

    expect(draftRes.status).toBe(201);
    const draftId = draftRes.body.data.idea._id;
    expect(draftRes.body.data.idea.status).toBe('draft');

    // Explore MUST NOT include drafts
    const exploreRes = await supertest(app).get('/api/ideas');
    expect(exploreRes.status).toBe(200);
    expect(exploreRes.body.data.ideas.some((i) => String(i._id) === String(draftId))).toBe(false);

    // Outsider cannot access private draft
    const outsiderRes = await visitor.agent.get(`/api/ideas/${draftId}`);
    expect(outsiderRes.status).toBe(403);

    // Owner CAN access their draft
    const ownerView = await owner.agent.get(`/api/ideas/${draftId}`);
    expect(ownerView.status).toBe(200);

    // Owner publishes the draft by completing required fields
    const publishRes = await owner.agent
      .put(`/api/ideas/${draftId}`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({
        status: 'active',
        title: 'Completed Developer Tools Project',
        shortSummary: 'Comprehensive CLI for automating distributed Kubernetes ephemeral environments.',
        problemStatement: 'Developers spend 45 minutes configuring dev pods manually every morning.',
        proposedSolution: 'Single binary CLI synthesizing cluster manifests in under 3 seconds.',
        detailedDescription: 'Full architecture overview: DaemonSet agent + local gRPC proxy + OIDC token cache.',
        category: 'Developer Tools',
        requiredRoles: ['Backend Developer'],
      });

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.idea.status).toBe('active');
    expect(publishRes.body.data.idea.version).toBe(2);

    // Now active idea appears in Explore
    const afterPublishExplore = await supertest(app).get('/api/ideas?q=Kubernetes');
    expect(afterPublishExplore.status).toBe(200);
    expect(afterPublishExplore.body.data.ideas.some((i) => String(i._id) === String(draftId))).toBe(true);
  });

  it('allows owner to revoke NDA access and enforces access gating immediately', async () => {
    const owner = await registerAndAuthAgent(app);
    const builder = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send({
        title: 'Confidential Quantum Encryption Layer',
        shortSummary: 'Post-quantum lattice cryptographic layer for banking transaction networks.',
        problemStatement: 'Current RSA keys will become insecure within the next computing generation.',
        proposedSolution: 'Kyber-based key exchange module compatible with existing TLS 1.3 stacks.',
        detailedDescription: 'PROPRIETARY LATTICE MATHEMATICS: Hardware acceleration specs for FPGA cards.',
        category: 'Cybersecurity & Privacy',
        visibility: 'public',
        protectDetailsWithNDA: true,
        requiredRoles: ['Security Researcher'],
      });

    const ideaId = createRes.body.data.idea._id;

    // Builder signs NDA
    const signRes = await builder.agent
      .post(`/api/ideas/${ideaId}/nda`)
      .set('X-CSRF-Token', builder.csrfToken)
      .send({ signerFullName: builder.user.name, acknowledged: true });

    expect(signRes.status).toBe(200);
    expect(signRes.body.data.idea.detailedDescription).toContain('PROPRIETARY LATTICE');

    // Owner reviews agreements and revokes builder's access
    const recordsRes = await owner.agent.get(`/api/ideas/${ideaId}/records`);
    const agreementId = recordsRes.body.data.agreements[0]._id;

    const revokeRes = await owner.agent
      .patch(`/api/ideas/${ideaId}/access`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({ revokeNdaAgreementId: agreementId, revokeReason: 'Security audit violation' });

    expect(revokeRes.status).toBe(200);

    // Builder now has revoked access: detailed description is once again null
    const afterRevokeView = await builder.agent.get(`/api/ideas/${ideaId}`);
    expect(afterRevokeView.status).toBe(200);
    expect(afterRevokeView.body.data.idea.detailedDescription).toBeNull();
    expect(afterRevokeView.body.data.idea.access.ndaRevoked).toBe(true);
  });

  it('enforces maximum collaborator limits on collaboration requests', async () => {
    const owner = await registerAndAuthAgent(app);
    const applicant = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send({
        title: 'Exclusive Two-Person Hackathon Sprint',
        shortSummary: 'Building an AI audio transcription plugin during a 48-hour global hackathon.',
        problemStatement: 'Audio meeting summaries omit tonal context and technical jargon.',
        proposedSolution: 'Whisper large-v3 fine-tuned with domain glossaries.',
        detailedDescription: 'Full hackathon architecture and milestone plan for Saturday and Sunday.',
        category: 'AI & Machine Learning',
        visibility: 'public',
        maxCollaborators: 1, // Already reached by creator
        requiredRoles: ['Full-Stack Developer'],
      });

    const ideaId = createRes.body.data.idea._id;

    const collabRes = await applicant.agent
      .post('/api/collaborations/requests')
      .set('X-CSRF-Token', applicant.csrfToken)
      .send({
        ideaId,
        desiredRole: 'Frontend Developer',
        message: 'I have extensive React audio streaming experience and would love to build this.',
        experience: '5 years of frontend React and WebAudio development.',
        contributionPlan: 'I will implement the live waveform visualizer.',
        signerFullName: applicant.user.name,
        ndaAccepted: true,
      });

    expect(collabRes.status).toBe(400);
    expect(collabRes.body.message).toContain('maximum team size limit');
  });

  it('enforces share link revocation for unlisted ideas', async () => {
    const owner = await registerAndAuthAgent(app);
    const viewer = await registerAndAuthAgent(app);

    const createRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send({
        title: 'Revocable Stealth Pitch Deck',
        shortSummary: 'Private unlisted preview for prospective angel investors only.',
        problemStatement: 'Pre-seed founders need revocable data rooms for investor meetings.',
        proposedSolution: 'Tokenized encrypted data room with instant access revocation.',
        detailedDescription: 'Detailed financial projections, cap table model, and unit economics.',
        category: 'FinTech',
        visibility: 'unlisted',
        requiredRoles: ['FinTech Advisor'],
      });

    const idea = createRes.body.data.idea;
    const token = idea.shareToken;

    // Initially accessible with token
    const viewWithToken = await viewer.agent.get(`/api/ideas/${idea._id}?token=${token}`);
    expect(viewWithToken.status).toBe(200);

    // Owner revokes the share link
    const revokeRes = await owner.agent
      .patch(`/api/ideas/${idea._id}/access`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({ revokeShareLink: true });

    expect(revokeRes.status).toBe(200);

    // Access with revoked token is rejected with 403
    const afterRevokeView = await viewer.agent.get(`/api/ideas/${idea._id}?token=${token}`);
    expect(afterRevokeView.status).toBe(403);
    expect(afterRevokeView.body.message).toContain('revoked');
  });
});

