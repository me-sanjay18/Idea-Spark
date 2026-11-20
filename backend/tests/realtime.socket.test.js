import http from 'node:http';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { initSocketServer } from '../src/sockets/socketServer.js';
import { clearTestDB, registerAndAuthAgent, setupTestDB, teardownTestDB } from './helpers.js';

const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { io: createClientSocket } = frontendRequire('socket.io-client');

function extractCookieHeader(res) {
  const setCookie = res.headers?.['set-cookie'] || [];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

function waitForEvent(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket event "${event}"`));
    }, timeoutMs);

    function handler(payload) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }

    socket.on(event, handler);
  });
}

describe('Real-Time Team Live Chat & Workspace Socket.IO Delivery', () => {
  let app;
  let httpServer;
  let ioServer;
  let serverUrl;

  beforeAll(async () => {
    await setupTestDB();
    app = createApp();
    httpServer = http.createServer(app);
    ioServer = initSocketServer(httpServer);
    await new Promise((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const { port } = httpServer.address();
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    if (ioServer) ioServer.close();
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    await teardownTestDB();
  });

  it('delivers Team Live Chat messages and workspace updates in real time without page reload', async () => {
    const owner = await registerAndAuthAgent(app, { name: 'Founder Priya', username: 'priya_rt' });
    const member = await registerAndAuthAgent(app, { name: 'Dev Rohan', username: 'rohan_rt' });

    // Connect both sockets BEFORE workspace even exists (simulates users already logged in)
    const ownerSocket = createClientSocket(serverUrl, {
      transports: ['polling', 'websocket'],
      extraHeaders: { Cookie: extractCookieHeader(owner.registerRes) },
    });
    const memberSocket = createClientSocket(serverUrl, {
      transports: ['polling', 'websocket'],
      extraHeaders: { Cookie: extractCookieHeader(member.registerRes) },
    });

    await Promise.all([
      waitForEvent(ownerSocket, 'connect'),
      waitForEvent(memberSocket, 'connect'),
    ]);

    try {
      // 1. Create Idea -> Request Collaboration -> Accept to create Team Workspace
      const ideaRes = await owner.agent
        .post('/api/ideas')
        .set('X-CSRF-Token', owner.csrfToken)
        .send({
          title: 'Real-Time Pair Builder Hub',
          shortSummary: 'Instant live team collaboration workspace with Socket.IO sync.',
          detailedDescription: 'Full architecture details for real-time team execution.',
          problemStatement: 'Remote student teams lose momentum when chat requires refreshing.',
          proposedSolution: 'Dual-room Socket.IO fanout with Vite WebSocket proxy.',
          category: 'Developer Tools',
          requiredSkills: ['React', 'Socket.IO'],
          visibility: 'public',
        });
      const ideaId = ideaRes.body.data.idea._id;

      const reqRes = await member.agent
        .post('/api/collaborations/requests')
        .set('X-CSRF-Token', member.csrfToken)
        .send({
          ideaId,
          desiredRole: 'Realtime Systems Engineer',
          message: 'Excited to build the WebSocket sync layer together!',
          skills: ['Node.js', 'Socket.IO'],
          experience: 'Built collaborative editors and live chat apps.',
          contributionPlan: 'Implement Socket.IO rooms and instant UI state updates.',
          ndaAccepted: true,
          signerFullName: 'Dev Rohan',
        });
      const requestId = reqRes.body.data.request._id;

      const acceptRes = await owner.agent
        .patch(`/api/collaborations/requests/${requestId}/respond`)
        .set('X-CSRF-Token', owner.csrfToken)
        .send({ decision: 'accept' });
      const collaborationId = acceptRes.body.data.collaborationId;

      const wsRes = await owner.agent.get(`/api/collaborations/${collaborationId}`);
      const convId = wsRes.body.data.collaboration.conversation;

      // 2. Member sends a message in Team Live Chat -> Owner receives 'message:new' immediately!
      const ownerMsgPromise = waitForEvent(ownerSocket, 'message:new');
      const sendRes = await member.agent
        .post(`/api/messages/conversations/${convId}/messages`)
        .set('X-CSRF-Token', member.csrfToken)
        .send({ content: 'Hello team! Real-time chat is working live!' });

      expect(sendRes.status).toBe(201);
      const receivedByOwner = await ownerMsgPromise;
      expect(receivedByOwner.content).toBe('Hello team! Real-time chat is working live!');
      expect(String(receivedByOwner.conversation)).toBe(String(convId));
      expect(receivedByOwner.sender.name).toBe('Dev Rohan');

      // 3. Owner replies -> Member receives 'message:new' immediately without reload!
      const memberMsgPromise = waitForEvent(memberSocket, 'message:new');
      const replyRes = await owner.agent
        .post(`/api/messages/conversations/${convId}/messages`)
        .set('X-CSRF-Token', owner.csrfToken)
        .send({ content: 'Awesome Rohan! Seeing this live right away!' });

      expect(replyRes.status).toBe(201);
      const receivedByMember = await memberMsgPromise;
      expect(receivedByMember.content).toBe('Awesome Rohan! Seeing this live right away!');
      expect(receivedByMember.sender.name).toBe('Founder Priya');

      // 4. Owner adds a milestone -> Member receives 'workspace:updated' live!
      const wsUpdatePromise = waitForEvent(memberSocket, 'workspace:updated');
      await owner.agent
        .post(`/api/collaborations/${collaborationId}/milestones`)
        .set('X-CSRF-Token', owner.csrfToken)
        .send({ title: 'Ship real-time Socket.IO chat', status: 'done' });

      const wsUpdate = await wsUpdatePromise;
      expect(String(wsUpdate.collaborationId)).toBe(String(collaborationId));
      expect(wsUpdate.milestones.some((m) => m.title === 'Ship real-time Socket.IO chat')).toBe(true);
    } finally {
      ownerSocket.disconnect();
      memberSocket.disconnect();
    }
  });

  it('broadcasts IdeaCard like/upvote counts in real time to logged-in users and guests while keeping private ideas isolated', async () => {
    const creator = await registerAndAuthAgent(app, { name: 'Creator Maya', username: 'maya_likes' });
    const voter = await registerAndAuthAgent(app, { name: 'Voter Arjun', username: 'arjun_likes' });

    const creatorSocket = createClientSocket(serverUrl, {
      transports: ['polling', 'websocket'],
      extraHeaders: { Cookie: extractCookieHeader(creator.registerRes) },
    });
    const guestSocket = createClientSocket(serverUrl, {
      transports: ['polling', 'websocket'],
    });

    await Promise.all([
      waitForEvent(creatorSocket, 'connect'),
      waitForEvent(guestSocket, 'connect'),
    ]);

    try {
      const publicIdeaRes = await creator.agent
        .post('/api/ideas')
        .set('X-CSRF-Token', creator.csrfToken)
        .send({
          title: 'Live Upvote Sync Engine',
          shortSummary: 'Instant real-time upvote counter across IdeaCard grids and detail views.',
          detailedDescription: 'Socket.IO live upvote counter for IdeaSpark cards.',
          problemStatement: 'Static like counters look stale when multiple users browse.',
          proposedSolution: 'Emit idea:voteUpdated events with privacy-aware fanout.',
          category: 'SaaS & Productivity',
          visibility: 'public',
        });
      const publicIdeaId = publicIdeaRes.body.data.idea._id;

      // Voter likes public idea -> both Creator socket AND Guest socket receive live count = 1
      const creatorVotePromise = waitForEvent(creatorSocket, 'idea:voteUpdated');
      const guestVotePromise = waitForEvent(guestSocket, 'idea:voteUpdated');

      const voteRes1 = await voter.agent
        .post(`/api/ideas/${publicIdeaId}/vote`)
        .set('X-CSRF-Token', voter.csrfToken);
      expect(voteRes1.status).toBe(200);
      expect(voteRes1.body.data).toEqual({ isUpvoted: true, upvoteCount: 1 });

      const [creatorEvent1, guestEvent1] = await Promise.all([creatorVotePromise, guestVotePromise]);
      expect(creatorEvent1).toEqual({ ideaId: String(publicIdeaId), upvoteCount: 1 });
      expect(guestEvent1).toEqual({ ideaId: String(publicIdeaId), upvoteCount: 1 });

      // Creator also likes -> both sockets receive live count = 2
      const guestVotePromise2 = waitForEvent(guestSocket, 'idea:voteUpdated');
      const voteRes2 = await creator.agent
        .post(`/api/ideas/${publicIdeaId}/vote`)
        .set('X-CSRF-Token', creator.csrfToken);
      expect(voteRes2.body.data).toEqual({ isUpvoted: true, upvoteCount: 2 });
      const guestEvent2 = await guestVotePromise2;
      expect(guestEvent2).toEqual({ ideaId: String(publicIdeaId), upvoteCount: 2 });

      // Private idea vote NEVER leaks to guest socket
      const privateIdeaRes = await creator.agent
        .post('/api/ideas')
        .set('X-CSRF-Token', creator.csrfToken)
        .send({
          title: 'Stealth Hardware Architecture',
          shortSummary: 'Confidential silicon photonics interconnect design for private collaborators.',
          detailedDescription: 'Strictly private internal architecture.',
          problemStatement: 'Confidential interconnect latency bottleneck.',
          proposedSolution: 'Private optical routing substrate.',
          category: 'AI & Machine Learning',
          visibility: 'private',
        });
      const privateIdeaId = privateIdeaRes.body.data.idea._id;

      let leakedToGuest = false;
      guestSocket.on('idea:voteUpdated', (payload) => {
        if (String(payload?.ideaId) === String(privateIdeaId)) {
          leakedToGuest = true;
        }
      });

      const ownerPrivateVotePromise = waitForEvent(creatorSocket, 'idea:voteUpdated');
      await creator.agent
        .post(`/api/ideas/${privateIdeaId}/vote`)
        .set('X-CSRF-Token', creator.csrfToken);

      const ownerPrivateEvent = await ownerPrivateVotePromise;
      expect(ownerPrivateEvent).toEqual({ ideaId: String(privateIdeaId), upvoteCount: 1 });
      await new Promise((r) => setTimeout(r, 150));
      expect(leakedToGuest).toBe(false);
    } finally {
      creatorSocket.disconnect();
      guestSocket.disconnect();
    }
  });
});

