import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clearTestDB, registerAndAuthAgent, setupTestDB, teardownTestDB } from './helpers.js';

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

describe('Collaboration Lifecycle, Workspaces & Messaging Boundaries', () => {
  it('handles collaboration request -> owner accept -> workspace creation -> team & direct messaging, while blocking strangers', async () => {
    const owner = await registerAndAuthAgent(app, { name: 'Founder Alice', username: 'alice' });
    const collaborator = await registerAndAuthAgent(app, { name: 'Dev Bob', username: 'bob' });
    const stranger = await registerAndAuthAgent(app, { name: 'Stranger Eve', username: 'eve' });

    // Collaborator disables unsolicited public DMs and only works on a project
    await collaborator.agent
      .patch('/api/users/me')
      .set('X-CSRF-Token', collaborator.csrfToken)
      .send({ allowDirectMessagesFromPublic: false });

    const ideaRes = await owner.agent
      .post('/api/ideas')
      .set('X-CSRF-Token', owner.csrfToken)
      .send({
        title: 'Autonomous Freight Route Optimizer',
        shortSummary: 'Real-time multi-modal logistics consolidation engine for regional carriers.',
        detailedDescription: 'Protected routing heuristics and carrier pricing graph.',
        problemStatement: 'Empty return miles cost regional trucking fleets billions annually.',
        proposedSolution: 'Cooperative graph matching engine with privacy-preserving capacity bids.',
        category: 'Climate & Sustainability',
        requiredSkills: ['Go', 'React'],
        visibility: 'public',
        protectDetailsWithNDA: true,
      });

    const ideaId = ideaRes.body.data.idea._id;

    // Bob submits collaboration request
    const reqRes = await collaborator.agent
      .post('/api/collaborations/requests')
      .set('X-CSRF-Token', collaborator.csrfToken)
      .send({
        ideaId,
        desiredRole: 'Backend Engineer',
        message: 'I have built logistics dispatch systems for 3 years and would love to co-build this.',
        skills: ['Go', 'PostgreSQL'],
        experience: '3 years building fleet telemetry APIs.',
        contributionPlan: 'Own the matching API and PostGIS spatial queries.',
        ndaAccepted: true,
        signerFullName: 'Dev Bob',
      });
    expect(reqRes.status).toBe(201);
    const requestId = reqRes.body.data.request._id;

    // Stranger cannot accept/reject Alice's request
    const hijackAccept = await stranger.agent
      .patch(`/api/collaborations/requests/${requestId}/respond`)
      .set('X-CSRF-Token', stranger.csrfToken)
      .send({ decision: 'accept' });
    expect(hijackAccept.status).toBe(403);

    // Alice accepts Bob's request -> Workspace + Team Conversation created
    const acceptRes = await owner.agent
      .patch(`/api/collaborations/requests/${requestId}/respond`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({ decision: 'accept', ownerNote: 'Thrilled to have you on the team!' });

    expect(acceptRes.status).toBe(200);
    const collaborationId = acceptRes.body.data.collaborationId;
    expect(collaborationId).toBeTruthy();

    // Bob accesses Collaboration Workspace and adds a milestone
    const wsRes = await collaborator.agent.get(`/api/collaborations/${collaborationId}`);
    expect(wsRes.status).toBe(200);
    expect(wsRes.body.data.collaboration.members).toHaveLength(2);
    const teamConvId = wsRes.body.data.collaboration.conversation;

    const milestoneRes = await collaborator.agent
      .post(`/api/collaborations/${collaborationId}/milestones`)
      .set('X-CSRF-Token', collaborator.csrfToken)
      .send({ title: 'Design PostGIS schema', status: 'in_progress' });
    expect(milestoneRes.status).toBe(201);

    // Stranger CANNOT view workspace or read/send team chat messages
    const strangerWs = await stranger.agent.get(`/api/collaborations/${collaborationId}`);
    expect(strangerWs.status).toBe(403);

    const strangerChat = await stranger.agent.get(`/api/messages/conversations/${teamConvId}/messages`);
    expect(strangerChat.status).toBe(403);

    // Stranger CANNOT cold-message Bob (private collaborator who hasn't published public ideas)
    const strangerDmBob = await stranger.agent
      .post('/api/messages/conversations/direct')
      .set('X-CSRF-Token', stranger.csrfToken)
      .send({ recipientId: collaborator.user._id });
    expect(strangerDmBob.status).toBe(403);
    expect(strangerDmBob.body.code).toBe('FORBIDDEN_STRANGER_MESSAGE');

    // Teammates Alice & Bob CAN message in team chat AND 1:1 direct chat
    const sendTeamMsg = await collaborator.agent
      .post(`/api/messages/conversations/${teamConvId}/messages`)
      .set('X-CSRF-Token', collaborator.csrfToken)
      .send({ content: 'Pushed initial spatial indexing benchmark!' });
    expect(sendTeamMsg.status).toBe(201);

    const aliceDmBob = await owner.agent
      .post('/api/messages/conversations/direct')
      .set('X-CSRF-Token', owner.csrfToken)
      .send({ recipientId: collaborator.user._id });
    expect(aliceDmBob.status).toBe(200);
  });
});

