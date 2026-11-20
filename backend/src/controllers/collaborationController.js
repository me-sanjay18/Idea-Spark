import { z } from 'zod';
import { Agreement } from '../models/Agreement.js';
import { Collaboration } from '../models/Collaboration.js';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { Conversation } from '../models/Conversation.js';
import { Idea } from '../models/Idea.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { recordAudit } from '../services/auditService.js';
import { evaluateIdeaAccess, serializeIdeaForViewer } from '../services/ideaAccessService.js';
import { createNotification, getSocketIO } from '../services/notificationService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { hashIp } from '../utils/tokens.js';

export const createCollabRequestSchema = z.object({
  ideaId: z.string().trim().min(1, 'Idea ID is required'),
  desiredRole: z.string().trim().min(2, 'Desired role is required').max(80),
  message: z.string().trim().min(15, 'Please write a short personalized message (min 15 chars)').max(2000),
  skills: z.array(z.string().trim().min(1).max(45)).max(15).optional().default([]),
  experience: z.string().trim().min(10, 'Please share your relevant experience').max(2000),
  contributionPlan: z.string().trim().min(10, 'Please explain how you can contribute').max(2000),
  ndaAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the confidentiality acknowledgement before requesting collaboration.' }),
  }),
  signerFullName: z.string().trim().min(2, 'Full name is required for confidentiality acknowledgement').max(100),
  shareToken: z.string().optional().default(''),
});

export const respondCollabRequestSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  ownerNote: z.string().trim().max(1000).optional().default(''),
});

export const milestoneSchema = z.object({
  title: z.string().trim().min(2, 'Milestone title is required').max(160),
  description: z.string().trim().max(1000).optional().default(''),
  status: z.enum(['todo', 'in_progress', 'done']).optional().default('todo'),
  assignee: z.string().nullable().optional().default(null),
  dueDate: z.string().nullable().optional().default(null),
});

export const projectUpdateInputSchema = z.object({
  title: z.string().trim().max(140).optional().default(''),
  content: z.string().trim().min(5, 'Update content must be at least 5 characters').max(3000),
});

export const sendCollaborationRequest = asyncHandler(async (req, res) => {
  const {
    ideaId,
    desiredRole,
    message,
    skills,
    experience,
    contributionPlan,
    ndaAccepted,
    signerFullName,
    shareToken,
  } = req.body;

  const idea = await Idea.findById(ideaId).select('+shareToken');
  if (!idea || idea.status !== 'active') {
    throw new AppError('This idea is not available for collaboration.', 404, 'IDEA_NOT_FOUND');
  }

  if (idea.allowCollaborationRequests === false) {
    throw new AppError('The owner has temporarily disabled collaboration requests for this idea.', 403, 'COLLAB_REQUESTS_DISABLED');
  }

  const maxCollabs = idea.maxCollaborators || idea.teamSize || 50;
  if ((idea.collaboratorCount || 1) >= maxCollabs) {
    throw new AppError(`This project has reached its maximum team size limit (${maxCollabs} members).`, 400, 'MAX_COLLABORATORS_REACHED');
  }

  if (String(idea.creator) === String(req.user._id)) {
    throw new AppError('You are already the creator of this idea.', 400, 'CANNOT_REQUEST_OWN_IDEA');
  }

  const access = await evaluateIdeaAccess(idea, req.user, shareToken);
  if (!access.canViewIdea) {
    throw new AppError('You do not have access to collaborate on this idea.', 403, 'FORBIDDEN_IDEA');
  }

  if (access.isCollaborator) {
    throw new AppError('You are already an active collaborator on this project.', 409, 'ALREADY_COLLABORATOR');
  }

  const owner = await User.findById(idea.creator);
  if (owner?.blockedUsers?.some((id) => String(id) === String(req.user._id))) {
    throw new AppError('Unable to send collaboration request to this creator.', 403, 'BLOCKED');
  }

  const existingPending = await CollaborationRequest.findOne({
    idea: idea._id,
    applicant: req.user._id,
    status: 'pending',
  });
  if (existingPending) {
    throw new AppError('You already have a pending collaboration request for this idea.', 409, 'DUPLICATE_REQUEST');
  }

  const version = idea.ndaVersion || 1;
  const statementText = `I, ${signerFullName}, acknowledge confidentiality obligations regarding Idea "${idea.title}" (${idea.ideaCode}) as part of my collaboration request and agree not to disclose non-public materials without written consent.`;

  const agreement = await Agreement.findOneAndUpdate(
    { user: req.user._id, idea: idea._id, agreementVersion: version },
    {
      user: req.user._id,
      idea: idea._id,
      ideaOwner: idea.creator,
      agreementVersion: version,
      agreementType: idea.customNdaUrl ? 'custom_nda' : 'standard_confidentiality',
      ndaDocumentUrl: idea.customNdaUrl || '',
      signerFullName,
      statementText,
      ipHash: hashIp(req.ip),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
      acceptedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const collabRequest = await CollaborationRequest.create({
    idea: idea._id,
    applicant: req.user._id,
    owner: idea.creator,
    desiredRole,
    message,
    skills: skills.length ? skills : req.user.skills || [],
    experience,
    contributionPlan,
    ndaAccepted,
    agreement: agreement._id,
    status: 'pending',
  });

  await collabRequest.populate([
    { path: 'applicant', select: 'name username avatarUrl headline skills' },
    { path: 'idea', select: 'title ideaCode category projectStage' },
  ]);

  await createNotification({
    recipient: idea.creator,
    actor: req.user._id,
    type: 'collab_request',
    title: 'New Collaboration Request',
    body: `${req.user.name} applied to join "${idea.title}" as ${desiredRole}.`,
    link: '/requests',
    metadata: { ideaId: idea._id, requestId: collabRequest._id },
  });

  await recordAudit({
    actor: req.user._id,
    action: 'COLLAB_REQUEST_SENT',
    entityType: 'collaboration',
    entityId: collabRequest._id,
    idea: idea._id,
    summary: `@${req.user.username} requested to join ${idea.ideaCode} as ${desiredRole}`,
    ip: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Collaboration request sent to the idea owner!',
    data: { request: collabRequest },
  });
});

export const listCollaborationRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const statusFilter = status && status !== 'all' ? { status } : {};

  const [received, sent] = await Promise.all([
    CollaborationRequest.find({ owner: req.user._id, ...statusFilter })
      .populate('applicant', 'name username avatarUrl headline bio skills socialLinks emailVerified')
      .populate('idea', 'title ideaCode category projectStage visibility teamSize collaboratorCount')
      .populate('agreement', 'agreementVersion signerFullName acceptedAt agreementType')
      .sort({ createdAt: -1 }),
    CollaborationRequest.find({ applicant: req.user._id, ...statusFilter })
      .populate('owner', 'name username avatarUrl headline')
      .populate('idea', 'title ideaCode category projectStage visibility')
      .sort({ createdAt: -1 }),
  ]);

  return sendSuccess(res, {
    data: { received, sent },
  });
});

export const respondToCollaborationRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { decision, ownerNote } = req.body;

  const collabReq = await CollaborationRequest.findById(requestId)
    .populate('applicant', 'name username avatarUrl headline')
    .populate('idea');

  if (!collabReq) {
    throw new AppError('Collaboration request not found.', 404, 'REQUEST_NOT_FOUND');
  }

  if (String(collabReq.owner) !== String(req.user._id)) {
    throw new AppError('Only the idea owner can respond to collaboration requests.', 403, 'FORBIDDEN_NOT_OWNER');
  }

  if (collabReq.status !== 'pending') {
    throw new AppError(`This request has already been ${collabReq.status}.`, 400, 'ALREADY_PROCESSED');
  }

  const idea = collabReq.idea;
  collabReq.ownerNote = ownerNote || '';
  collabReq.respondedAt = new Date();

  if (decision === 'reject') {
    collabReq.status = 'rejected';
    await collabReq.save();

    await createNotification({
      recipient: collabReq.applicant._id,
      actor: req.user._id,
      type: 'collab_rejected',
      title: 'Update on Collaboration Request',
      body: `Your request to join "${idea.title}" was declined${ownerNote ? `: "${ownerNote}"` : '.'}`,
      link: '/requests',
      metadata: { ideaId: idea._id },
    });

    await recordAudit({
      actor: req.user._id,
      action: 'COLLAB_REQUEST_REJECTED',
      entityType: 'collaboration',
      entityId: collabReq._id,
      idea: idea._id,
      summary: `Rejected @${collabReq.applicant.username}'s collaboration request`,
      ip: req.ip,
    });

    return sendSuccess(res, {
      message: 'Collaboration request declined.',
      data: { request: collabReq },
    });
  }

  // ACCEPT FLOW: Provision or update Collaboration Workspace + Private Team Conversation
  collabReq.status = 'accepted';
  await collabReq.save();

  let collaboration = await Collaboration.findOne({ idea: idea._id });
  let teamConversation = null;

  if (!collaboration) {
    teamConversation = await Conversation.create({
      type: 'team',
      title: `${idea.title} — Team Workspace`,
      participants: [req.user._id, collabReq.applicant._id],
      idea: idea._id,
      lastMessageAt: new Date(),
    });

    collaboration = await Collaboration.create({
      idea: idea._id,
      owner: req.user._id,
      members: [
        { user: req.user._id, role: 'Founder & Project Lead', isOwner: true, joinedAt: idea.createdAt || new Date() },
        { user: collabReq.applicant._id, role: collabReq.desiredRole, isOwner: false, joinedAt: new Date() },
      ],
      milestones: [
        {
          title: 'Project Kickoff & Architecture Alignment',
          description: 'Align on goals, responsibilities, timeline, and initial deliverables.',
          status: 'in_progress',
          createdBy: req.user._id,
        },
      ],
      updates: [
        {
          author: req.user._id,
          title: 'Workspace Initialized',
          content: `Welcome aboard! ${collabReq.applicant.name} joined as ${collabReq.desiredRole}.`,
          createdAt: new Date(),
        },
      ],
      conversation: teamConversation._id,
      status: 'active',
    });

    teamConversation.collaboration = collaboration._id;
    await teamConversation.save();
  } else {
    const alreadyMember = collaboration.members.some(
      (m) => String(m.user) === String(collabReq.applicant._id)
    );
    if (!alreadyMember) {
      collaboration.members.push({
        user: collabReq.applicant._id,
        role: collabReq.desiredRole,
        isOwner: false,
        joinedAt: new Date(),
      });
    }
    collaboration.updates.unshift({
      author: req.user._id,
      title: 'New Team Member Joined',
      content: `${collabReq.applicant.name} (@${collabReq.applicant.username}) joined the team as ${collabReq.desiredRole}.`,
      createdAt: new Date(),
    });

    if (collaboration.conversation) {
      teamConversation = await Conversation.findByIdAndUpdate(
        collaboration.conversation,
        {
          $addToSet: { participants: collabReq.applicant._id },
          $set: { lastMessageAt: new Date() },
        },
        { new: true }
      );
    } else {
      teamConversation = await Conversation.create({
        type: 'team',
        title: `${idea.title} — Team Workspace`,
        participants: collaboration.members.map((m) => m.user),
        collaboration: collaboration._id,
        idea: idea._id,
      });
      collaboration.conversation = teamConversation._id;
    }

    await collaboration.save();
  }

  // Post welcome system message in team chat
  if (teamConversation) {
    const sysMsg = await Message.create({
      conversation: teamConversation._id,
      sender: req.user._id,
      content: `${collabReq.applicant.name} joined the workspace as ${collabReq.desiredRole}.`,
      systemMessage: true,
      readBy: [{ user: req.user._id, readAt: new Date() }],
    });
    teamConversation.lastMessage = sysMsg._id;
    teamConversation.lastMessageAt = sysMsg.createdAt;
    await teamConversation.save();

    const io = getSocketIO();
    if (io) {
      const populatedMsg = await sysMsg.populate('sender', 'name username avatarUrl');
      const targetRooms = [
        `conversation:${String(teamConversation._id)}`,
        ...(teamConversation.participants || []).map((p) => `user:${String(p?._id || p)}`),
      ];
      io.to(targetRooms).emit('message:new', populatedMsg);
    }
  }

  // Authorize applicant on Idea and update collaboratorCount
  await Idea.findByIdAndUpdate(idea._id, {
    $addToSet: { authorizedUsers: collabReq.applicant._id },
    $set: { collaboratorCount: collaboration.members.length },
  });

  // Notify applicant & existing team members
  await createNotification({
    recipient: collabReq.applicant._id,
    actor: req.user._id,
    type: 'collab_accepted',
    title: 'Collaboration Request Accepted!',
    body: `Welcome to "${idea.title}"! Your collaboration workspace is now unlocked.`,
    link: `/workspaces/${collaboration._id}`,
    metadata: { collaborationId: collaboration._id, ideaId: idea._id },
  });

  for (const member of collaboration.members) {
    const memberId = String(member.user);
    if (memberId !== String(req.user._id) && memberId !== String(collabReq.applicant._id)) {
      await createNotification({
        recipient: member.user,
        actor: req.user._id,
        type: 'team_member_joined',
        title: 'New Collaborator Joined',
        body: `${collabReq.applicant.name} joined "${idea.title}" as ${collabReq.desiredRole}.`,
        link: `/workspaces/${collaboration._id}`,
      });
    }
  }

  await recordAudit({
    actor: req.user._id,
    action: 'COLLAB_REQUEST_ACCEPTED',
    entityType: 'collaboration',
    entityId: collaboration._id,
    idea: idea._id,
    summary: `Accepted @${collabReq.applicant.username} into ${idea.ideaCode} as ${collabReq.desiredRole}`,
    ip: req.ip,
  });

  return sendSuccess(res, {
    message: `${collabReq.applicant.name} has been added to your project workspace!`,
    data: {
      request: collabReq,
      collaborationId: collaboration._id,
    },
  });
});

export const withdrawCollaborationRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const collabReq = await CollaborationRequest.findById(requestId);
  if (!collabReq) {
    throw new AppError('Collaboration request not found.', 404, 'REQUEST_NOT_FOUND');
  }

  if (String(collabReq.applicant) !== String(req.user._id)) {
    throw new AppError('You can only withdraw your own requests.', 403, 'FORBIDDEN');
  }

  if (collabReq.status !== 'pending') {
    throw new AppError(`Cannot withdraw a request that is already ${collabReq.status}.`, 400, 'INVALID_STATE');
  }

  collabReq.status = 'withdrawn';
  await collabReq.save();

  return sendSuccess(res, {
    message: 'Collaboration request withdrawn.',
    data: { request: collabReq },
  });
});

export const listMyCollaborations = asyncHandler(async (req, res) => {
  const collaborations = await Collaboration.find({ 'members.user': req.user._id })
    .populate('idea', 'title ideaCode shortSummary category projectStage visibility collaboratorCount')
    .populate('owner', 'name username avatarUrl headline')
    .populate('members.user', 'name username avatarUrl headline')
    .sort({ updatedAt: -1 });

  return sendSuccess(res, {
    data: { collaborations },
  });
});

function assertWorkspaceMember(collaboration, user) {
  if (!collaboration) {
    throw new AppError('Collaboration workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
  }
  const isMember = collaboration.members.some((m) => String(m.user?._id || m.user) === String(user._id));
  if (!isMember && user.role !== 'admin') {
    throw new AppError('Access restricted to authorized workspace team members.', 403, 'FORBIDDEN_WORKSPACE');
  }
}

function emitWorkspaceUpdate(collaboration, payload) {
  const io = getSocketIO();
  if (!io || !collaboration) return;
  const memberRooms = (collaboration.members || []).map((m) => `user:${String(m.user?._id || m.user)}`);
  if (memberRooms.length > 0) {
    io.to(memberRooms).emit('workspace:updated', {
      collaborationId: String(collaboration._id),
      ...payload,
    });
  }
}

export const getCollaborationWorkspace = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const collaboration = await Collaboration.findById(id)
    .populate('owner', 'name username avatarUrl headline')
    .populate('members.user', 'name username avatarUrl headline skills socialLinks')
    .populate('milestones.assignee', 'name username avatarUrl')
    .populate('updates.author', 'name username avatarUrl')
    .populate({
      path: 'idea',
      populate: { path: 'creator', select: 'name username avatarUrl headline' },
    });

  assertWorkspaceMember(collaboration, req.user);

  const access = await evaluateIdeaAccess(collaboration.idea, req.user);

  return sendSuccess(res, {
    data: {
      collaboration: {
        _id: collaboration._id,
        owner: collaboration.owner,
        members: collaboration.members,
        milestones: collaboration.milestones,
        updates: collaboration.updates,
        conversation: collaboration.conversation,
        status: collaboration.status,
        createdAt: collaboration.createdAt,
        updatedAt: collaboration.updatedAt,
        idea: serializeIdeaForViewer(collaboration.idea, access),
      },
    },
  });
});

export const addMilestone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const collaboration = await Collaboration.findById(id).populate('idea', 'title');
  assertWorkspaceMember(collaboration, req.user);

  const { title, description, status, assignee, dueDate } = req.body;
  collaboration.milestones.push({
    title,
    description,
    status,
    assignee: assignee || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    createdBy: req.user._id,
    updatedAt: new Date(),
  });

  await collaboration.save();
  await collaboration.populate('milestones.assignee', 'name username avatarUrl');
  emitWorkspaceUpdate(collaboration, { milestones: collaboration.milestones });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Project milestone added.',
    data: { milestones: collaboration.milestones },
  });
});

export const updateMilestone = asyncHandler(async (req, res) => {
  const { id, milestoneId } = req.params;
  const collaboration = await Collaboration.findById(id);
  assertWorkspaceMember(collaboration, req.user);

  const milestone = collaboration.milestones.id(milestoneId);
  if (!milestone) {
    throw new AppError('Milestone not found.', 404, 'MILESTONE_NOT_FOUND');
  }

  const { title, description, status, assignee, dueDate } = req.body;
  if (title !== undefined) milestone.title = title;
  if (description !== undefined) milestone.description = description;
  if (status !== undefined && ['todo', 'in_progress', 'done'].includes(status)) milestone.status = status;
  if (assignee !== undefined) milestone.assignee = assignee || null;
  if (dueDate !== undefined) milestone.dueDate = dueDate ? new Date(dueDate) : null;
  milestone.updatedAt = new Date();

  await collaboration.save();
  await collaboration.populate('milestones.assignee', 'name username avatarUrl');
  emitWorkspaceUpdate(collaboration, { milestones: collaboration.milestones });

  return sendSuccess(res, {
    message: 'Milestone updated.',
    data: { milestones: collaboration.milestones },
  });
});

export const deleteMilestone = asyncHandler(async (req, res) => {
  const { id, milestoneId } = req.params;
  const collaboration = await Collaboration.findById(id);
  assertWorkspaceMember(collaboration, req.user);

  const milestone = collaboration.milestones.id(milestoneId);
  if (!milestone) {
    throw new AppError('Milestone not found.', 404, 'MILESTONE_NOT_FOUND');
  }

  const isOwner = String(collaboration.owner) === String(req.user._id);
  const isCreator = String(milestone.createdBy) === String(req.user._id);
  if (!isOwner && !isCreator && req.user.role !== 'admin') {
    throw new AppError('Only the project owner or milestone creator can remove it.', 403, 'FORBIDDEN');
  }

  milestone.deleteOne();
  await collaboration.save();
  await collaboration.populate('milestones.assignee', 'name username avatarUrl');
  emitWorkspaceUpdate(collaboration, { milestones: collaboration.milestones });

  return sendSuccess(res, {
    message: 'Milestone removed.',
    data: { milestones: collaboration.milestones },
  });
});

export const postProjectUpdate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  const collaboration = await Collaboration.findById(id).populate('idea', 'title');
  assertWorkspaceMember(collaboration, req.user);

  collaboration.updates.unshift({
    author: req.user._id,
    title: title || '',
    content,
    createdAt: new Date(),
  });
  await collaboration.save();
  await collaboration.populate('updates.author', 'name username avatarUrl');
  emitWorkspaceUpdate(collaboration, { updates: collaboration.updates });

  for (const member of collaboration.members) {
    if (String(member.user) !== String(req.user._id)) {
      await createNotification({
        recipient: member.user,
        actor: req.user._id,
        type: 'project_update',
        title: `Project Update: ${collaboration.idea?.title || 'Workspace'}`,
        body: `${req.user.name} posted an update${title ? `: ${title}` : ''}`,
        link: `/workspaces/${collaboration._id}`,
      });
    }
  }

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Project update shared with the team.',
    data: { updates: collaboration.updates },
  });
});

export const updateOrRemoveMember = asyncHandler(async (req, res) => {
  const { id, memberUserId } = req.params;
  const { role, remove, status } = req.body;

  const collaboration = await Collaboration.findById(id).populate('idea');
  if (!collaboration) {
    throw new AppError('Workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
  }

  if (String(collaboration.owner) !== String(req.user._id)) {
    throw new AppError('Only the project owner can manage team roles and membership.', 403, 'FORBIDDEN_NOT_OWNER');
  }

  if (status && ['active', 'paused', 'completed'].includes(status)) {
    collaboration.status = status;
  }

  if (memberUserId) {
    if (remove) {
      if (String(memberUserId) === String(collaboration.owner)) {
        throw new AppError('The project owner cannot be removed from the workspace.', 400, 'CANNOT_REMOVE_OWNER');
      }
      collaboration.members = collaboration.members.filter((m) => String(m.user) !== String(memberUserId));

      if (collaboration.conversation) {
        await Conversation.findByIdAndUpdate(collaboration.conversation, {
          $pull: { participants: memberUserId },
        });
      }
      await Idea.findByIdAndUpdate(collaboration.idea._id, {
        $pull: { authorizedUsers: memberUserId },
        $set: { collaboratorCount: collaboration.members.length },
      });
    } else if (role) {
      const targetMember = collaboration.members.find((m) => String(m.user) === String(memberUserId));
      if (!targetMember) {
        throw new AppError('Team member not found.', 404, 'MEMBER_NOT_FOUND');
      }
      targetMember.role = String(role).trim().slice(0, 80);
    }
  }

  await collaboration.save();
  await collaboration.populate('members.user', 'name username avatarUrl headline skills');
  emitWorkspaceUpdate(collaboration, { members: collaboration.members, status: collaboration.status });

  return sendSuccess(res, {
    message: remove ? 'Team member removed from workspace.' : 'Workspace settings updated.',
    data: { members: collaboration.members, status: collaboration.status },
  });
});

