import crypto from 'node:crypto';
import fsSync from 'node:fs';
import { z } from 'zod';
import { env, refreshAiEnv } from '../config/env.js';
import { validateAttachmentBufferSignature } from '../middleware/upload.js';
import { Agreement } from '../models/Agreement.js';
import { AuditLog } from '../models/AuditLog.js';
import { Bookmark } from '../models/Bookmark.js';
import { Category } from '../models/Category.js';
import { Collaboration } from '../models/Collaboration.js';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { Idea } from '../models/Idea.js';
import { User } from '../models/User.js';
import { Vote } from '../models/Vote.js';
import { recordAudit } from '../services/auditService.js';
import {
  evaluateIdeaAccess,
  serializeIdeaCard,
  serializeIdeaForViewer,
} from '../services/ideaAccessService.js';
import { getSocketIO } from '../services/notificationService.js';
import {
  resolveStoredDocumentPath,
  storeUploadedFile,
  verifyPreviewKey,
} from '../services/uploadService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { buildPaginationMeta, sendSuccess } from '../utils/apiResponse.js';
import { hashIp } from '../utils/tokens.js';

const attachmentInputSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(600),
  storageKey: z.string().trim().max(260).optional().default(''),
  publicId: z.string().trim().max(260).optional().default(''),
  mimeType: z.string().trim().max(100).optional().default('application/octet-stream'),
  size: z.number().nonnegative().optional().default(0),
  isProtected: z.boolean().optional().default(true),
});

const keyFeatureInputSchema = z.object({
  _id: z.string().optional(),
  title: z.string().trim().min(1, 'Feature title cannot be empty').max(160),
  description: z.string().trim().max(600).optional().default(''),
});

const referenceLinkInputSchema = z.object({
  _id: z.string().optional(),
  title: z.string().trim().max(140).optional().default(''),
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((val) => /^https?:\/\/.+/i.test(val), 'Reference URL must start with http:// or https://'),
});

const baseIdeaFieldsSchema = z.object({
  status: z.enum(['draft', 'active']).optional().default('active'),

  // Section 1: Basic Information & Problem
  title: z.string().trim().max(140, 'Title cannot exceed 140 characters').optional().default(''),
  shortSummary: z
    .string()
    .trim()
    .max(320, 'Short summary cannot exceed 320 characters')
    .optional()
    .default(''),
  problemStatement: z.string().trim().max(4000).optional().default(''),
  targetAudience: z.string().trim().max(1500).optional().default(''),
  industryDomain: z.string().trim().max(120).optional().default(''),
  existingAlternatives: z.string().trim().max(3000).optional().default(''),
  marketOpportunity: z.string().trim().max(3000).optional().default(''),

  // Section 2: Solution & Product Specifications
  proposedSolution: z.string().trim().max(6000).optional().default(''),
  detailedDescription: z.string().trim().max(12000).optional().default(''),
  uniqueSellingProposition: z.string().trim().max(2000).optional().default(''),
  keyFeatures: z.array(keyFeatureInputSchema).max(25).optional().default([]),
  expectedOutcome: z.string().trim().max(3000).optional().default(''),
  successMetrics: z.string().trim().max(2000).optional().default(''),
  referenceLinks: z.array(referenceLinkInputSchema).max(20).optional().default([]),

  // Section 3: Team, Skills & Collaboration
  category: z.string().trim().max(60).optional().default(''),
  requiredSkills: z.array(z.string().trim().min(1).max(45)).max(25).optional().default([]),
  requiredRoles: z.array(z.string().trim().min(1).max(60)).max(25).optional().default([]),
  expectedDuration: z.string().trim().max(80).optional().default('1 - 3 months'),
  teamSize: z.coerce.number().int().min(1).max(50).optional().default(4),
  projectStage: z
    .enum(['concept', 'validation', 'prototype', 'mvp', 'launched'])
    .optional()
    .default('concept'),
  collaborationType: z
    .enum(['', 'open_source', 'startup', 'academic', 'research', 'hackathon', 'personal'])
    .optional()
    .default('startup'),
  workArrangement: z.enum(['', 'remote', 'onsite', 'hybrid']).optional().default('remote'),
  weeklyCommitment: z.enum(['', '2-5', '5-10', '10-20', '20+']).optional().default('5-10'),
  compensationModel: z
    .enum(['', 'unpaid', 'paid', 'equity', 'revenue_share', 'open'])
    .optional()
    .default('open'),
  collaborationRequirements: z.string().trim().max(3000).optional().default(''),

  // Section 4: Privacy, NDA & Additional Controls
  visibility: z.enum(['public', 'unlisted', 'private']).optional().default('public'),
  protectDetailsWithNDA: z.boolean().optional().default(false),
  customNdaUrl: z.string().trim().max(600).optional().default(''),
  customNdaStorageKey: z.string().trim().max(260).optional().default(''),
  customNdaName: z.string().trim().max(180).optional().default(''),
  allowCollaborationRequests: z.boolean().optional().default(true),
  requireOwnerApproval: z.boolean().optional().default(true),
  maxCollaborators: z.coerce.number().int().min(1).max(50).optional().default(5),
  shareLinkExpiresAt: z.union([z.string().trim(), z.null()]).optional().default(null),

  // Section 5: Attachments
  attachments: z.array(attachmentInputSchema).max(10).optional().default([]),
});

function validatePublishReadyFields(data, ctx) {
  if (!data.title || data.title.trim().length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Title must be at least 5 characters',
    });
  }
  if (!data.shortSummary || data.shortSummary.trim().length < 20) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['shortSummary'],
      message: 'Short summary must be at least 20 characters',
    });
  }
  if (data.shortSummary && data.shortSummary.trim().length > 320) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['shortSummary'],
      message: 'Short summary cannot exceed 320 characters',
    });
  }
  if (!data.problemStatement || data.problemStatement.trim().length < 15) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['problemStatement'],
      message: 'Problem statement must be at least 15 characters',
    });
  }
  if (!data.proposedSolution || data.proposedSolution.trim().length < 15) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['proposedSolution'],
      message: 'Proposed solution must be at least 15 characters',
    });
  }
  if (!data.detailedDescription || data.detailedDescription.trim().length < 30) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['detailedDescription'],
      message: 'Detailed description must be at least 30 characters',
    });
  }
  if (!data.category || data.category.trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category'],
      message: 'Category is required',
    });
  }
}

export const createIdeaSchema = baseIdeaFieldsSchema.superRefine((data, ctx) => {
  if (data.status !== 'draft') {
    validatePublishReadyFields(data, ctx);
  }
  if (data.shareLinkExpiresAt) {
    const parsedDate = new Date(data.shareLinkExpiresAt);
    if (Number.isNaN(parsedDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shareLinkExpiresAt'],
        message: 'Invalid link expiration date',
      });
    }
  }
});

export const updateIdeaSchema = baseIdeaFieldsSchema
  .omit({ status: true })
  .partial()
  .extend({
    editSummary: z.string().trim().max(200).optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
  });

function assertPublishedIdeaIntegrity(idea) {
  if (idea.status !== 'active') return;
  if (!idea.title || idea.title.trim().length < 5) {
    throw new AppError('Title must be at least 5 characters to publish.', 400, 'VALIDATION_ERROR');
  }
  if (!idea.shortSummary || idea.shortSummary.trim().length < 20 || idea.shortSummary.trim().length > 320) {
    throw new AppError(
      'Short public summary must be between 20 and 320 characters to publish.',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!idea.problemStatement || idea.problemStatement.trim().length < 15) {
    throw new AppError('Problem statement must be at least 15 characters to publish.', 400, 'VALIDATION_ERROR');
  }
  if (!idea.proposedSolution || idea.proposedSolution.trim().length < 15) {
    throw new AppError('Proposed solution must be at least 15 characters to publish.', 400, 'VALIDATION_ERROR');
  }
  if (!idea.detailedDescription || idea.detailedDescription.trim().length < 30) {
    throw new AppError(
      'Detailed description & roadmap must be at least 30 characters to publish.',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!idea.category || idea.category.trim().length < 2) {
    throw new AppError('Category is required to publish.', 400, 'VALIDATION_ERROR');
  }
}

function parseOptionalDate(val) {
  if (!val) return null;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('Invalid expiration date format.', 400, 'INVALID_DATE');
  }
  return parsed;
}

function dedupeStrings(arr = []) {
  return [...new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))];
}

function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const getLandingData = asyncHandler(async (req, res) => {
  const [featuredDocs, categories, totalPublicIdeas, totalUsers, totalCollaborations] = await Promise.all([
    Idea.find({ visibility: 'public', status: 'active' })
      .populate('creator', 'name username avatarUrl headline')
      .sort({ featured: -1, upvoteCount: -1, createdAt: -1 })
      .limit(6),
    Category.find({ isActive: true }).sort({ name: 1 }),
    Idea.countDocuments({ visibility: 'public', status: 'active' }),
    User.countDocuments({ status: 'active' }),
    Collaboration.countDocuments({ status: 'active' }),
  ]);

  const categoryCountsAgg = await Idea.aggregate([
    { $match: { visibility: 'public', status: 'active' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(categoryCountsAgg.map((c) => [c._id, c.count]));

  let bookmarkedSet = new Set();
  let upvotedSet = new Set();
  if (req.user) {
    const ids = featuredDocs.map((d) => d._id);
    const [bms, votes] = await Promise.all([
      Bookmark.find({ user: req.user._id, idea: { $in: ids } }).select('idea'),
      Vote.find({ user: req.user._id, idea: { $in: ids } }).select('idea'),
    ]);
    bookmarkedSet = new Set(bms.map((b) => String(b.idea)));
    upvotedSet = new Set(votes.map((v) => String(v.idea)));
  }

  return sendSuccess(res, {
    data: {
      featuredIdeas: featuredDocs.map((doc) =>
        serializeIdeaCard(doc, {
          isBookmarked: bookmarkedSet.has(String(doc._id)),
          isUpvoted: upvotedSet.has(String(doc._id)),
        })
      ),
      categories: categories.map((cat) => ({
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        ideaCount: countMap.get(cat.name) || 0,
      })),
      stats: {
        publicIdeas: totalPublicIdeas,
        activeBuilders: totalUsers,
        activeCollaborations: totalCollaborations,
        categoriesCount: categories.length,
      },
    },
  });
});

export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  return sendSuccess(res, { data: { categories } });
});

export const exploreIdeas = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
  const skip = (page - 1) * limit;

  const { q, category, skill, stage, sort = 'newest' } = req.query;

  // STRICT PRIVACY INVARIANT: Explore NEVER includes private, unlisted, draft, archived, or removed ideas
  const filter = {
    visibility: 'public',
    status: 'active',
  };

  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [
      { title: rx },
      { shortSummary: rx },
      { requiredSkills: rx },
      { requiredRoles: rx },
      { category: rx },
      { industryDomain: rx },
    ];
  }

  if (category && category !== 'all') {
    filter.category = String(category).trim();
  }

  if (skill && String(skill).trim()) {
    filter.requiredSkills = { $regex: new RegExp(`^${escapeRegex(String(skill).trim())}$`, 'i') };
  }

  if (stage && stage !== 'all') {
    filter.projectStage = String(stage).trim();
  }

  let sortSpec = { createdAt: -1 };
  if (sort === 'popular') {
    sortSpec = { upvoteCount: -1, viewsCount: -1, createdAt: -1 };
  } else if (sort === 'collaborative') {
    sortSpec = { collaboratorCount: -1, upvoteCount: -1, createdAt: -1 };
  }

  const [total, docs] = await Promise.all([
    Idea.countDocuments(filter),
    Idea.find(filter)
      .populate('creator', 'name username avatarUrl headline')
      .sort(sortSpec)
      .skip(skip)
      .limit(limit),
  ]);

  let bookmarkedSet = new Set();
  let upvotedSet = new Set();
  if (req.user && docs.length > 0) {
    const ids = docs.map((d) => d._id);
    const [bms, votes] = await Promise.all([
      Bookmark.find({ user: req.user._id, idea: { $in: ids } }).select('idea'),
      Vote.find({ user: req.user._id, idea: { $in: ids } }).select('idea'),
    ]);
    bookmarkedSet = new Set(bms.map((b) => String(b.idea)));
    upvotedSet = new Set(votes.map((v) => String(v.idea)));
  }

  return sendSuccess(res, {
    data: {
      ideas: docs.map((doc) =>
        serializeIdeaCard(doc, {
          isBookmarked: bookmarkedSet.has(String(doc._id)),
          isUpvoted: upvotedSet.has(String(doc._id)),
        })
      ),
    },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getMyIdeas = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  const filter = {
    creator: req.user._id,
    status: { $ne: 'removed' },
  };

  if (req.query.visibility && ['public', 'unlisted', 'private'].includes(req.query.visibility)) {
    filter.visibility = req.query.visibility;
  }
  if (req.query.status && ['draft', 'active', 'archived'].includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [total, docs] = await Promise.all([
    Idea.countDocuments(filter),
    Idea.find(filter)
      .select('+shareToken')
      .populate('creator', 'name username avatarUrl headline')
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return sendSuccess(res, {
    data: {
      ideas: docs.map((doc) => serializeIdeaCard(doc, { includeOwnerFields: true })),
    },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const createIdea = asyncHandler(async (req, res) => {
  const payload = req.body;
  const isDraft = payload.status === 'draft';
  const skills = dedupeStrings(payload.requiredSkills);
  const roles = dedupeStrings(payload.requiredRoles);
  const expiresAt = parseOptionalDate(payload.shareLinkExpiresAt);

  const safeTitle = payload.title?.trim() || (isDraft ? 'Untitled Idea Draft' : '');
  const safeCategory = payload.category?.trim() || 'AI & Machine Learning';
  const safeExpectedDuration = payload.expectedDuration?.trim() || '1 - 3 months';

  const idea = await Idea.create({
    title: safeTitle,
    shortSummary: payload.shortSummary || '',
    problemStatement: payload.problemStatement || '',
    targetAudience: payload.targetAudience || '',
    industryDomain: payload.industryDomain || '',
    existingAlternatives: payload.existingAlternatives || '',
    marketOpportunity: payload.marketOpportunity || '',

    proposedSolution: payload.proposedSolution || '',
    detailedDescription: payload.detailedDescription || '',
    uniqueSellingProposition: payload.uniqueSellingProposition || '',
    keyFeatures: payload.keyFeatures || [],
    expectedOutcome: payload.expectedOutcome || '',
    successMetrics: payload.successMetrics || '',
    referenceLinks: payload.referenceLinks || [],

    category: safeCategory,
    requiredSkills: skills,
    requiredRoles: roles,
    expectedDuration: safeExpectedDuration,
    teamSize: payload.teamSize || 4,
    projectStage: payload.projectStage || 'concept',
    collaborationType: payload.collaborationType ?? 'startup',
    workArrangement: payload.workArrangement ?? 'remote',
    weeklyCommitment: payload.weeklyCommitment ?? '5-10',
    compensationModel: payload.compensationModel ?? 'open',
    collaborationRequirements: payload.collaborationRequirements || '',

    visibility: payload.visibility || 'public',
    status: isDraft ? 'draft' : 'active',
    protectDetailsWithNDA: Boolean(payload.protectDetailsWithNDA),
    customNdaUrl: payload.customNdaUrl || '',
    customNdaStorageKey: payload.customNdaStorageKey || '',
    customNdaName: payload.customNdaName || '',
    allowCollaborationRequests: payload.allowCollaborationRequests !== false,
    requireOwnerApproval: payload.requireOwnerApproval !== false,
    maxCollaborators: payload.maxCollaborators || payload.teamSize || 5,
    shareLinkExpiresAt: expiresAt,
    attachments: (payload.attachments || []).map((att) => ({
      name: att.name,
      url: att.url,
      storageKey: att.storageKey || '',
      publicId: att.publicId || '',
      mimeType: att.mimeType || 'application/octet-stream',
      size: att.size || 0,
      isProtected: att.isProtected !== false,
    })),

    creator: req.user._id,
    version: 1,
    ownershipHistory: [
      {
        action: isDraft ? 'draft_saved' : 'created',
        actor: req.user._id,
        previousValue: '',
        newValue: `status:${isDraft ? 'draft' : 'active'} | visibility:${payload.visibility || 'public'} | nda:${Boolean(
          payload.protectDetailsWithNDA
        )}`,
        timestamp: new Date(),
      },
    ],
  });

  const fullIdea = await Idea.findById(idea._id)
    .select('+shareToken')
    .populate('creator', 'name username avatarUrl headline');

  await recordAudit({
    actor: req.user._id,
    action: isDraft ? 'IDEA_DRAFT_CREATED' : 'IDEA_CREATED',
    entityType: 'idea',
    entityId: idea._id,
    idea: idea._id,
    summary: isDraft
      ? `Saved draft ${idea.ideaCode}`
      : `Published idea ${idea.ideaCode} (${idea.visibility})`,
    metadata: {
      status: idea.status,
      visibility: idea.visibility,
      protectDetailsWithNDA: idea.protectDetailsWithNDA,
    },
    ip: req.ip,
  });

  const access = await evaluateIdeaAccess(fullIdea, req.user, fullIdea.shareToken);

  return sendSuccess(res, {
    statusCode: 201,
    message: isDraft
      ? 'Draft saved! Only you can view this draft until you publish it.'
      : 'Your idea has been published with ownership timestamp recorded!',
    data: {
      idea: serializeIdeaForViewer(fullIdea, access, { includeShareToken: true }),
    },
  });
});

export const getIdeaById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shareToken = String(req.query.token || '');

  const idea = await Idea.findById(id)
    .select('+shareToken')
    .populate('creator', 'name username avatarUrl headline bio skills socialLinks emailVerified')
    .populate('editHistory.editor', 'name username')
    .populate('ownershipHistory.actor', 'name username')
    .populate('authorizedUsers', 'name username email avatarUrl');

  if (!idea) {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const access = await evaluateIdeaAccess(idea, req.user, shareToken);

  if (!access.canViewIdea) {
    if (access.reason === 'IDEA_REMOVED') {
      throw new AppError('This idea is no longer available.', 404, 'IDEA_NOT_FOUND');
    }
    if (access.reason === 'IDEA_DRAFT') {
      throw new AppError('This idea is currently a private draft.', 403, 'IDEA_DRAFT');
    }
    if (access.reason === 'SHARE_LINK_EXPIRED_OR_REVOKED') {
      throw new AppError(
        'This unlisted sharing link has expired or been revoked by the idea owner.',
        403,
        'SHARE_LINK_EXPIRED_OR_REVOKED'
      );
    }
    throw new AppError(
      'You do not have permission to access this protected idea.',
      403,
      access.reason || 'FORBIDDEN_IDEA'
    );
  }

  if (!access.isOwner && idea.status === 'active') {
    Idea.findByIdAndUpdate(idea._id, { $inc: { viewsCount: 1 } }).catch(() => {});

    // Log authorized non-public / NDA-unlocked access events (deduped within 30 minutes)
    if (access.usedValidShareToken || access.isExplicitlyAuthorized || access.hasAcceptedNda) {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const actorId = req.user?._id || null;
      AuditLog.findOne({
        idea: idea._id,
        action: 'IDEA_AUTHORIZED_ACCESS',
        ...(actorId ? { actor: actorId } : { ipHash: hashIp(req.ip) }),
        createdAt: { $gte: thirtyMinsAgo },
      })
        .then((recentLog) => {
          if (!recentLog) {
            return recordAudit({
              actor: actorId,
              action: 'IDEA_AUTHORIZED_ACCESS',
              entityType: 'idea',
              entityId: idea._id,
              idea: idea._id,
              summary: req.user
                ? `@${req.user.username} accessed protected/shared idea (${
                    access.usedValidShareToken
                      ? 'unlisted token'
                      : access.hasAcceptedNda
                      ? 'NDA verified'
                      : 'authorized viewer'
                  })`
                : 'Visitor accessed unlisted idea via valid share link',
              ip: req.ip,
            });
          }
          return null;
        })
        .catch(() => {});
    }
  }

  let isBookmarked = false;
  let isUpvoted = false;
  let myRequest = null;

  if (req.user) {
    const [bm, vote, existingReq] = await Promise.all([
      Bookmark.exists({ user: req.user._id, idea: idea._id }),
      Vote.exists({ user: req.user._id, idea: idea._id }),
      CollaborationRequest.findOne({ idea: idea._id, applicant: req.user._id })
        .sort({ createdAt: -1 })
        .select('status desiredRole createdAt ownerNote'),
    ]);
    isBookmarked = Boolean(bm);
    isUpvoted = Boolean(vote);
    myRequest = existingReq;
  }

  return sendSuccess(res, {
    data: {
      idea: serializeIdeaForViewer(idea, access, { isBookmarked, isUpvoted, shareToken }),
      myCollaborationRequest: myRequest,
    },
  });
});

export const updateIdea = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idea = await Idea.findById(id).select('+shareToken');

  if (!idea || idea.status === 'removed') {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  if (String(idea.creator) !== String(req.user._id)) {
    throw new AppError('Only the idea owner can modify this idea.', 403, 'FORBIDDEN_NOT_OWNER');
  }

  const updates = { ...req.body };

  // Never allow client payloads to mutate immutable ownership fields
  delete updates.creator;
  delete updates.createdAt;
  delete updates.ideaCode;
  delete updates._id;

  if (updates.requiredSkills !== undefined) {
    updates.requiredSkills = dedupeStrings(updates.requiredSkills);
  }
  if (updates.requiredRoles !== undefined) {
    updates.requiredRoles = dedupeStrings(updates.requiredRoles);
  }
  if (updates.shareLinkExpiresAt !== undefined) {
    updates.shareLinkExpiresAt = parseOptionalDate(updates.shareLinkExpiresAt);
  }

  const trackableFields = [
    'title',
    'shortSummary',
    'problemStatement',
    'targetAudience',
    'industryDomain',
    'existingAlternatives',
    'marketOpportunity',
    'proposedSolution',
    'detailedDescription',
    'uniqueSellingProposition',
    'keyFeatures',
    'expectedOutcome',
    'successMetrics',
    'referenceLinks',
    'category',
    'requiredSkills',
    'requiredRoles',
    'expectedDuration',
    'teamSize',
    'projectStage',
    'collaborationType',
    'workArrangement',
    'weeklyCommitment',
    'compensationModel',
    'collaborationRequirements',
    'visibility',
    'protectDetailsWithNDA',
    'customNdaUrl',
    'customNdaStorageKey',
    'customNdaName',
    'allowCollaborationRequests',
    'requireOwnerApproval',
    'maxCollaborators',
    'shareLinkExpiresAt',
    'attachments',
    'status',
  ];

  // Capture snapshot of current version before applying mutations
  const previousSnapshot = {
    version: idea.version || 1,
    title: idea.title,
    shortSummary: idea.shortSummary,
    problemStatement: idea.problemStatement,
    proposedSolution: idea.proposedSolution,
    detailedDescription: idea.detailedDescription,
    visibility: idea.visibility,
    status: idea.status,
    protectDetailsWithNDA: idea.protectDetailsWithNDA,
    capturedAt: idea.updatedAt || idea.createdAt,
  };

  const changedFields = [];
  const previousVisibility = idea.visibility;
  const previousStatus = idea.status;
  const previousNda = idea.protectDetailsWithNDA;
  const previousCustomNda = `${idea.customNdaStorageKey || ''}|${idea.customNdaUrl || ''}`;

  for (const field of trackableFields) {
    if (updates[field] !== undefined) {
      const oldVal = JSON.stringify(idea[field]);
      const newVal = JSON.stringify(updates[field]);
      if (oldVal !== newVal) {
        changedFields.push(field);
        idea[field] = updates[field];
      }
    }
  }

  if (idea.status === 'draft' && (!idea.title || !idea.title.trim())) {
    idea.title = 'Untitled Idea Draft';
  }
  if (idea.status === 'draft' && (!idea.category || !idea.category.trim())) {
    idea.category = 'AI & Machine Learning';
  }

  // Enforce strict validation whenever the idea is in 'active' (published) status
  assertPublishedIdeaIntegrity(idea);

  if (previousVisibility !== idea.visibility) {
    idea.ownershipHistory.push({
      action: 'visibility_changed',
      actor: req.user._id,
      previousValue: previousVisibility,
      newValue: idea.visibility,
      timestamp: new Date(),
    });
  }

  if (previousStatus !== idea.status) {
    idea.ownershipHistory.push({
      action: previousStatus === 'draft' && idea.status === 'active' ? 'published' : 'status_changed',
      actor: req.user._id,
      previousValue: previousStatus,
      newValue: idea.status,
      timestamp: new Date(),
    });
  }

  const currentCustomNda = `${idea.customNdaStorageKey || ''}|${idea.customNdaUrl || ''}`;
  if (previousNda !== idea.protectDetailsWithNDA || previousCustomNda !== currentCustomNda) {
    if (idea.protectDetailsWithNDA && (!previousNda || previousCustomNda !== currentCustomNda)) {
      idea.ndaVersion = (idea.ndaVersion || 1) + 1;
    }
    idea.ownershipHistory.push({
      action: 'nda_policy_changed',
      actor: req.user._id,
      previousValue: `nda:${previousNda}`,
      newValue: `nda:${idea.protectDetailsWithNDA} (v${idea.ndaVersion})`,
      timestamp: new Date(),
    });
  }

  if (changedFields.length > 0) {
    const nextVersion = (idea.version || 1) + 1;
    idea.version = nextVersion;

    idea.editHistory.push({
      version: nextVersion,
      editor: req.user._id,
      editedAt: new Date(),
      summary:
        updates.editSummary ||
        (previousStatus === 'draft' && idea.status === 'active'
          ? 'Published idea from draft'
          : `Updated ${changedFields.slice(0, 6).join(', ')}${changedFields.length > 6 ? '...' : ''}`),
      changedFields,
      snapshot: previousSnapshot,
    });

    await idea.save();

    await recordAudit({
      actor: req.user._id,
      action: 'IDEA_UPDATED',
      entityType: 'idea',
      entityId: idea._id,
      idea: idea._id,
      summary: `v${nextVersion} — Updated fields: ${changedFields.join(', ')}`,
      metadata: { version: nextVersion, changedFields, visibility: idea.visibility, status: idea.status },
      ip: req.ip,
    });
  }

  await idea.populate('creator', 'name username avatarUrl headline');
  await idea.populate('editHistory.editor', 'name username');
  await idea.populate('ownershipHistory.actor', 'name username');
  const access = await evaluateIdeaAccess(idea, req.user, idea.shareToken);

  return sendSuccess(res, {
    message:
      previousStatus === 'draft' && idea.status === 'active'
        ? 'Your draft has been published!'
        : idea.status === 'draft'
        ? 'Draft saved.'
        : 'Idea updated and version history recorded.',
    data: {
      idea: serializeIdeaForViewer(idea, access, { includeShareToken: true }),
    },
  });
});

export const manageIdeaAccessAndStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    visibility,
    status,
    rotateShareToken,
    revokeShareLink,
    shareLinkExpiresAt,
    allowCollaborationRequests,
    requireOwnerApproval,
    maxCollaborators,
    addAuthorizedIdentifier,
    removeAuthorizedUserId,
    revokeNdaAgreementId,
    revokeReason,
  } = req.body;

  const idea = await Idea.findById(id).select('+shareToken');
  if (!idea || idea.status === 'removed') {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  if (String(idea.creator) !== String(req.user._id)) {
    throw new AppError('Only the idea owner can manage access and visibility.', 403, 'FORBIDDEN_NOT_OWNER');
  }

  if (visibility && ['public', 'unlisted', 'private'].includes(visibility) && visibility !== idea.visibility) {
    const prev = idea.visibility;
    idea.visibility = visibility;
    idea.ownershipHistory.push({
      action: 'visibility_changed',
      actor: req.user._id,
      previousValue: prev,
      newValue: visibility,
      timestamp: new Date(),
    });
  }

  if (status && ['draft', 'active', 'archived'].includes(status) && status !== idea.status) {
    const prevStatus = idea.status;
    idea.status = status;
    assertPublishedIdeaIntegrity(idea);
    idea.ownershipHistory.push({
      action: prevStatus === 'draft' && status === 'active' ? 'published' : 'status_changed',
      actor: req.user._id,
      previousValue: prevStatus,
      newValue: status,
      timestamp: new Date(),
    });
  }

  if (rotateShareToken) {
    idea.shareToken = crypto.randomBytes(18).toString('hex');
    idea.shareLinkRevoked = false;
    idea.ownershipHistory.push({
      action: 'share_link_rotated',
      actor: req.user._id,
      previousValue: 'active_or_revoked',
      newValue: 'new_token_generated',
      timestamp: new Date(),
    });
  }

  if (revokeShareLink === true) {
    idea.shareLinkRevoked = true;
    idea.ownershipHistory.push({
      action: 'share_link_revoked',
      actor: req.user._id,
      previousValue: 'active',
      newValue: 'revoked',
      timestamp: new Date(),
    });
  } else if (revokeShareLink === false) {
    idea.shareLinkRevoked = false;
  }

  if (shareLinkExpiresAt !== undefined) {
    idea.shareLinkExpiresAt = parseOptionalDate(shareLinkExpiresAt);
  }

  if (typeof allowCollaborationRequests === 'boolean') {
    idea.allowCollaborationRequests = allowCollaborationRequests;
  }
  if (typeof requireOwnerApproval === 'boolean') {
    idea.requireOwnerApproval = requireOwnerApproval;
  }
  if (maxCollaborators !== undefined) {
    const maxNum = Number(maxCollaborators);
    if (Number.isInteger(maxNum) && maxNum >= 1 && maxNum <= 50) {
      idea.maxCollaborators = maxNum;
    }
  }

  if (addAuthorizedIdentifier) {
    const ident = String(addAuthorizedIdentifier).toLowerCase().trim();
    const targetUser = await User.findOne({ $or: [{ username: ident }, { email: ident }] });
    if (!targetUser) {
      throw new AppError('No user found with that username or email.', 404, 'USER_NOT_FOUND');
    }
    if (!idea.authorizedUsers.some((u) => String(u) === String(targetUser._id))) {
      idea.authorizedUsers.push(targetUser._id);
      idea.ownershipHistory.push({
        action: 'access_granted',
        actor: req.user._id,
        previousValue: '',
        newValue: `@${targetUser.username}`,
        timestamp: new Date(),
      });
    }
  }

  if (removeAuthorizedUserId) {
    const removedUser = await User.findById(removeAuthorizedUserId).select('username');
    idea.authorizedUsers = idea.authorizedUsers.filter((u) => String(u) !== String(removeAuthorizedUserId));
    idea.ownershipHistory.push({
      action: 'access_revoked',
      actor: req.user._id,
      previousValue: removedUser ? `@${removedUser.username}` : String(removeAuthorizedUserId),
      newValue: 'revoked',
      timestamp: new Date(),
    });
  }

  if (revokeNdaAgreementId) {
    const agreement = await Agreement.findOne({
      _id: revokeNdaAgreementId,
      idea: idea._id,
    }).populate('user', 'username name');

    if (!agreement) {
      throw new AppError('Agreement record not found for this idea.', 404, 'AGREEMENT_NOT_FOUND');
    }

    agreement.revokedAt = new Date();
    agreement.revokedBy = req.user._id;
    agreement.revokeReason = String(revokeReason || 'Revoked by idea owner').slice(0, 300);
    await agreement.save();

    // Also remove from explicit authorizedUsers if present
    idea.authorizedUsers = idea.authorizedUsers.filter(
      (u) => String(u) !== String(agreement.user?._id || agreement.user)
    );

    idea.ownershipHistory.push({
      action: 'nda_access_revoked',
      actor: req.user._id,
      previousValue: `v${agreement.agreementVersion}`,
      newValue: `@${agreement.user?.username || agreement.signerFullName}`,
      timestamp: new Date(),
    });

    await recordAudit({
      actor: req.user._id,
      action: 'NDA_ACCESS_REVOKED',
      entityType: 'agreement',
      entityId: agreement._id,
      idea: idea._id,
      summary: `Revoked NDA access for ${agreement.signerFullName} (@${agreement.user?.username || 'user'})`,
      ip: req.ip,
    });
  }

  await idea.save();
  await idea.populate('authorizedUsers', 'name username email avatarUrl');
  await idea.populate('creator', 'name username avatarUrl headline');
  await idea.populate('editHistory.editor', 'name username');
  await idea.populate('ownershipHistory.actor', 'name username');

  await recordAudit({
    actor: req.user._id,
    action: 'IDEA_ACCESS_UPDATED',
    entityType: 'idea',
    entityId: idea._id,
    idea: idea._id,
    summary: `Visibility/access updated (${idea.visibility}, ${idea.status})`,
    ip: req.ip,
  });

  const access = await evaluateIdeaAccess(idea, req.user, idea.shareToken);

  return sendSuccess(res, {
    message: 'Idea privacy & access settings updated.',
    data: {
      idea: serializeIdeaForViewer(idea, access, { includeShareToken: true }),
    },
  });
});

export const deleteIdea = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idea = await Idea.findById(id);

  if (!idea || idea.status === 'removed') {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const isOwner = String(idea.creator) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('You are not authorized to delete this idea.', 403, 'FORBIDDEN_NOT_OWNER');
  }

  idea.status = 'removed';
  idea.visibility = 'private';
  idea.shareLinkRevoked = true;
  await idea.save();

  await Promise.all([
    Bookmark.deleteMany({ idea: idea._id }),
    Vote.deleteMany({ idea: idea._id }),
    CollaborationRequest.updateMany({ idea: idea._id, status: 'pending' }, { $set: { status: 'withdrawn' } }),
  ]);

  await recordAudit({
    actor: req.user._id,
    action: isAdmin && !isOwner ? 'ADMIN_IDEA_REMOVED' : 'IDEA_DELETED',
    entityType: 'idea',
    entityId: idea._id,
    idea: idea._id,
    summary: `Idea ${idea.ideaCode} deleted`,
    ip: req.ip,
  });

  return sendSuccess(res, {
    message: 'Idea deleted successfully.',
  });
});

export const signConfidentialityAgreement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signerFullName, acknowledged, shareToken = '' } = req.body;

  if (!acknowledged) {
    throw new AppError('You must explicitly acknowledge the confidentiality terms.', 400, 'ACKNOWLEDGEMENT_REQUIRED');
  }
  if (!signerFullName || String(signerFullName).trim().length < 2) {
    throw new AppError('Please enter your full legal name to record acceptance.', 400, 'NAME_REQUIRED');
  }

  const idea = await Idea.findById(id)
    .select('+shareToken')
    .populate('creator', 'name username avatarUrl headline');

  if (!idea || idea.status === 'removed' || idea.status === 'draft') {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const access = await evaluateIdeaAccess(idea, req.user, shareToken);
  if (!access.canViewIdea) {
    throw new AppError('You are not authorized to view or sign agreements for this idea.', 403, 'FORBIDDEN_IDEA');
  }

  const version = idea.ndaVersion || 1;

  // Check if owner explicitly revoked this user's agreement for the current NDA version
  const existingAgreement = await Agreement.findOne({
    user: req.user._id,
    idea: idea._id,
    agreementVersion: version,
  });
  if (existingAgreement?.revokedAt) {
    throw new AppError(
      'Your confidentiality access to this idea version was revoked by the creator. Contact the owner to request access again.',
      403,
      'NDA_ACCESS_REVOKED'
    );
  }

  const statementText = `I, ${String(signerFullName).trim()}, acknowledge that materials shared for Idea "${idea.title}" (${idea.ideaCode}) are confidential to the creator and collaborators. I agree not to disclose, reproduce, or misappropriate non-public details without written authorization. I understand that platform timestamps and electronic acknowledgements record intent and auditability, and actual legal enforceability depends on applicable law and executed agreements.`;

  const agreement = await Agreement.findOneAndUpdate(
    {
      user: req.user._id,
      idea: idea._id,
      agreementVersion: version,
    },
    {
      user: req.user._id,
      idea: idea._id,
      ideaOwner: idea.creator._id || idea.creator,
      agreementVersion: version,
      agreementType: idea.customNdaUrl || idea.customNdaStorageKey ? 'custom_nda' : 'standard_confidentiality',
      ndaDocumentUrl:
        idea.customNdaUrl || idea.customNdaStorageKey ? `/api/ideas/${idea._id}/nda-document` : '',
      signerFullName: String(signerFullName).trim(),
      statementText,
      ipHash: hashIp(req.ip),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
      lastAcceptedAt: new Date(),
      revokedAt: null,
      revokedBy: null,
      revokeReason: '',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await recordAudit({
    actor: req.user._id,
    action: 'CONFIDENTIALITY_AGREEMENT_ACCEPTED',
    entityType: 'agreement',
    entityId: agreement._id,
    idea: idea._id,
    summary: `${req.user.name} (@${req.user.username}) accepted confidentiality v${version} for ${idea.ideaCode}`,
    ip: req.ip,
  });

  const refreshedAccess = await evaluateIdeaAccess(idea, req.user, shareToken);

  return sendSuccess(res, {
    message: 'Confidentiality acknowledgement recorded. Protected project details unlocked.',
    data: {
      agreement,
      idea: serializeIdeaForViewer(idea, refreshedAccess, { shareToken }),
    },
  });
});

export const getIdeaRecords = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idea = await Idea.findById(id)
    .select('+shareToken')
    .populate('editHistory.editor', 'name username')
    .populate('ownershipHistory.actor', 'name username');

  if (!idea) {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const isOwner = String(idea.creator) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (isOwner || isAdmin) {
    const [agreements, auditLogs] = await Promise.all([
      Agreement.find({ idea: idea._id })
        .populate('user', 'name username email avatarUrl')
        .populate('revokedBy', 'name username')
        .sort({ acceptedAt: -1 }),
      AuditLog.find({ idea: idea._id })
        .populate('actor', 'name username')
        .sort({ createdAt: -1 })
        .limit(60),
    ]);

    return sendSuccess(res, {
      data: {
        ideaCode: idea.ideaCode,
        version: idea.version || 1,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
        editHistory: idea.editHistory || [],
        ownershipHistory: idea.ownershipHistory || [],
        agreements,
        auditLogs,
      },
    });
  }

  const myAgreements = await Agreement.find({ idea: idea._id, user: req.user._id }).sort({ acceptedAt: -1 });
  return sendSuccess(res, {
    data: {
      ideaCode: idea.ideaCode,
      version: idea.version || 1,
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
      agreements: myAgreements,
      auditLogs: [],
    },
  });
});

function streamLocalFileWithHeaders(res, localPath, mimeType, fileName) {
  const safeName = String(fileName || 'document').replace(/["\r\n]/g, '_');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);

  const stream = fsSync.createReadStream(localPath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({ success: false, message: 'Attachment file not found on server.' });
    }
  });
  stream.pipe(res);
}

export const uploadIdeaFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please choose a valid file to upload.', 400, 'NO_FILE');
  }

  validateAttachmentBufferSignature(req.file);

  const uploaded = await storeUploadedFile(req.file, {
    folder: 'ideaspark/documents',
    resourceType: 'auto',
    isPrivate: true,
    uploaderId: req.user._id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'File uploaded securely.',
    data: { file: uploaded },
  });
});

export const previewUploadedIdeaFile = asyncHandler(async (req, res) => {
  const key = String(req.query.key || '');
  const sig = String(req.query.sig || '');

  if (!verifyPreviewKey(req.user._id, key, sig)) {
    throw new AppError('Unauthorized file preview request.', 403, 'FORBIDDEN_FILE_PREVIEW');
  }

  const resolved = await resolveStoredDocumentPath({ storageKey: key });
  if (!resolved || !resolved.localPath) {
    throw new AppError('Uploaded file preview not found.', 404, 'FILE_NOT_FOUND');
  }

  const ext = key.split('.').pop()?.toLowerCase();
  const mimeMap = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    txt: 'text/plain; charset=utf-8',
  };
  return streamLocalFileWithHeaders(res, resolved.localPath, mimeMap[ext] || 'application/octet-stream', key);
});

export const downloadIdeaAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  const shareToken = String(req.query.token || '');

  const idea = await Idea.findById(id).select('+shareToken');
  if (!idea) {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const access = await evaluateIdeaAccess(idea, req.user, shareToken);
  if (!access.canViewIdea) {
    throw new AppError('You do not have permission to access this idea.', 403, 'FORBIDDEN_IDEA');
  }

  const att = idea.attachments.id(attachmentId);
  if (!att) {
    throw new AppError('Attachment not found.', 404, 'ATTACHMENT_NOT_FOUND');
  }

  if (att.isProtected && !access.canViewProtectedDetails) {
    throw new AppError(
      'Protected attachment requires sign-in and NDA acknowledgement.',
      403,
      'FORBIDDEN_PROTECTED_ATTACHMENT'
    );
  }

  const resolved = await resolveStoredDocumentPath({
    storageKey: att.storageKey,
    legacyUrl: att.url,
  });

  if (!resolved) {
    throw new AppError('Attachment file could not be located.', 404, 'FILE_NOT_FOUND');
  }

  if (resolved.redirectUrl) {
    return res.redirect(resolved.redirectUrl);
  }

  return streamLocalFileWithHeaders(res, resolved.localPath, att.mimeType, att.name);
});

export const downloadIdeaCustomNda = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shareToken = String(req.query.token || '');

  const idea = await Idea.findById(id).select('+shareToken');
  if (!idea) {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const access = await evaluateIdeaAccess(idea, req.user, shareToken);
  if (!access.canViewIdea) {
    throw new AppError('You do not have permission to view this NDA document.', 403, 'FORBIDDEN_IDEA');
  }

  const resolved = await resolveStoredDocumentPath({
    storageKey: idea.customNdaStorageKey,
    legacyUrl: idea.customNdaUrl,
  });

  if (!resolved) {
    throw new AppError('Custom NDA document not found.', 404, 'FILE_NOT_FOUND');
  }

  if (resolved.redirectUrl) {
    return res.redirect(resolved.redirectUrl);
  }

  const ext = (idea.customNdaName || idea.customNdaStorageKey || '').split('.').pop()?.toLowerCase();
  const mimeMap = {
    pdf: 'application/pdf',
    txt: 'text/plain; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return streamLocalFileWithHeaders(
    res,
    resolved.localPath,
    mimeMap[ext] || 'application/pdf',
    idea.customNdaName || 'custom-nda.pdf'
  );
});

export const getAiAssistantStatus = asyncHandler(async (_req, res) => {
  refreshAiEnv();
  const hasGemini = Boolean(env.ai.geminiApiKey);
  const hasOpenAi = Boolean(env.ai.openaiApiKey);
  return sendSuccess(res, {
    data: {
      enabled: hasGemini || hasOpenAi,
      provider: hasGemini ? 'gemini' : hasOpenAi ? 'openai' : null,
    },
  });
});

export const aiAssistSchema = z.object({
  field: z.enum([
    'title',
    'shortSummary',
    'problemStatement',
    'proposedSolution',
    'keyFeatures',
    'detailedDescription',
  ]),
  currentText: z.string().trim().max(8000).optional().default(''),
  context: z
    .object({
      title: z.string().trim().max(200).optional().default(''),
      shortSummary: z.string().trim().max(400).optional().default(''),
      problemStatement: z.string().trim().max(2000).optional().default(''),
      category: z.string().trim().max(80).optional().default(''),
    })
    .optional()
    .default({}),
});

export const assistIdeaWriting = asyncHandler(async (req, res) => {
  refreshAiEnv();
  const { field, currentText, context } = req.body;

  if (!env.ai.geminiApiKey && !env.ai.openaiApiKey) {
    throw new AppError(
      'AI Writing Assistant is not configured on this server.',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  const instructionsByField = {
    title:
      'Suggest a crisp, memorable product/startup idea title under 110 characters. Return ONLY the improved title text.',
    shortSummary:
      'Write a clear, compelling public elevator pitch strictly between 60 and 280 characters without revealing proprietary secrets. Return ONLY the summary text.',
    problemStatement:
      'Refine this into a structured, clear problem statement explaining the pain point, who experiences it, and why current solutions fall short. Return ONLY the improved text.',
    proposedSolution:
      'Refine this proposed solution clearly, focusing on user value and core product mechanism. Return ONLY the improved text.',
    keyFeatures:
      'Generate 4 to 6 concrete product features as JSON array of objects [{"title": "...", "description": "..."}]. Return ONLY valid JSON.',
    detailedDescription:
      'Improve and organize this detailed product description & MVP roadmap into clear readable sections (Architecture, MVP Milestones, Execution Plan). Return ONLY the improved text.',
  };

  const prompt = [
    'You are a startup product mentor assisting a founder on IdeaSpark.',
    instructionsByField[field],
    context?.title ? `Idea Title: ${context.title}` : '',
    context?.category ? `Category: ${context.category}` : '',
    context?.shortSummary ? `Summary Context: ${context.shortSummary}` : '',
    context?.problemStatement ? `Problem Context: ${context.problemStatement}` : '',
    currentText ? `User Draft:\n${currentText}` : 'No draft text yet; generate based on the context above.',
  ]
    .filter(Boolean)
    .join('\n\n');

  let suggestionText = '';

  if (env.ai.geminiApiKey) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        env.ai.geminiApiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 900 },
        }),
      }
    );
    if (!resp.ok) {
      throw new AppError('AI service returned an error. Please try again later.', 502, 'AI_UPSTREAM_ERROR');
    }
    const json = await resp.json();
    suggestionText = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } else if (env.ai.openaiApiKey) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ai.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 900,
      }),
    });
    if (!resp.ok) {
      throw new AppError('AI service returned an error. Please try again later.', 502, 'AI_UPSTREAM_ERROR');
    }
    const json = await resp.json();
    suggestionText = json?.choices?.[0]?.message?.content?.trim() || '';
  }

  if (!suggestionText) {
    throw new AppError('No suggestion generated. Please add a bit more context first.', 422, 'AI_EMPTY');
  }

  let parsedFeatures = null;
  if (field === 'keyFeatures') {
    try {
      const cleaned = suggestionText.replace(/^```json\s*|\s*```$/gi, '').trim();
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr)) {
        parsedFeatures = arr
          .filter((item) => item?.title)
          .slice(0, 8)
          .map((item) => ({
            title: String(item.title).trim().slice(0, 160),
            description: String(item.description || '').trim().slice(0, 600),
          }));
      }
    } catch {
      parsedFeatures = null;
    }
  }

  return sendSuccess(res, {
    data: {
      field,
      suggestion: suggestionText,
      features: parsedFeatures,
    },
  });
});

export const toggleUpvote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idea = await Idea.findById(id).select('+shareToken');
  if (!idea || idea.status !== 'active') {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const access = await evaluateIdeaAccess(idea, req.user, String(req.query.token || ''));
  if (!access.canViewIdea) {
    throw new AppError('You do not have access to upvote this idea.', 403, 'FORBIDDEN_IDEA');
  }

  const existing = await Vote.findOne({ user: req.user._id, idea: idea._id });
  let isUpvoted = false;
  if (existing) {
    await existing.deleteOne();
    isUpvoted = false;
  } else {
    await Vote.create({ user: req.user._id, idea: idea._id });
    isUpvoted = true;
  }

  const upvoteCount = await Vote.countDocuments({ idea: idea._id });
  idea.upvoteCount = upvoteCount;
  await idea.save();

  const io = getSocketIO();
  if (io) {
    const ideaIdStr = String(idea._id);
    const voterIdStr = String(req.user._id);

    io.to(`user:${voterIdStr}`).emit('idea:myVoteUpdated', {
      ideaId: ideaIdStr,
      upvoteCount,
      isUpvoted,
    });

    if (idea.visibility === 'public') {
      io.emit('idea:voteUpdated', {
        ideaId: ideaIdStr,
        upvoteCount,
      });
    } else {
      const collab = await Collaboration.findOne({ idea: idea._id }).select('members.user');
      const authorizedRooms = new Set([
        `user:${String(idea.creator)}`,
        `user:${voterIdStr}`,
        ...(idea.authorizedUsers || []).map((u) => `user:${String(u?._id || u)}`),
        ...(collab?.members || []).map((m) => `user:${String(m.user?._id || m.user)}`),
      ]);
      io.to([...authorizedRooms]).emit('idea:voteUpdated', {
        ideaId: ideaIdStr,
        upvoteCount,
      });
    }
  }

  return sendSuccess(res, {
    message: isUpvoted ? 'Idea upvoted!' : 'Upvote removed.',
    data: { isUpvoted, upvoteCount },
  });
});
