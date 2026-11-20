import { z } from 'zod';
import { Agreement } from '../models/Agreement.js';
import { AuditLog } from '../models/AuditLog.js';
import { Category } from '../models/Category.js';
import { Collaboration } from '../models/Collaboration.js';
import { Idea } from '../models/Idea.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { recordAudit } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { buildPaginationMeta, sendSuccess } from '../utils/apiResponse.js';

export const reviewReportSchema = z.object({
  status: z.enum(['under_review', 'resolved', 'dismissed']),
  actionTaken: z.enum(['none', 'warning', 'idea_removed', 'user_suspended', 'user_banned']).default('none'),
  resolutionNote: z.string().trim().max(2000).optional().default(''),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().trim().max(500).optional().default(''),
  role: z.enum(['user', 'admin']).optional(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().default(''),
  icon: z.string().trim().max(40).optional().default('Sparkles'),
  isActive: z.boolean().optional().default(true),
});

export const getAdminOverview = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    suspendedUsers,
    totalIdeas,
    publicIdeas,
    privateIdeas,
    activeCollaborations,
    signedAgreements,
    openReports,
    recentAuditLogs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: { $in: ['suspended', 'banned'] } }),
    Idea.countDocuments({ status: { $ne: 'removed' } }),
    Idea.countDocuments({ visibility: 'public', status: 'active' }),
    Idea.countDocuments({ visibility: 'private', status: { $ne: 'removed' } }),
    Collaboration.countDocuments({ status: 'active' }),
    Agreement.countDocuments(),
    Report.countDocuments({ status: { $in: ['open', 'under_review'] } }),
    AuditLog.find()
      .populate('actor', 'name username email role')
      .populate('idea', 'title ideaCode')
      .sort({ createdAt: -1 })
      .limit(25),
  ]);

  return sendSuccess(res, {
    data: {
      stats: {
        totalUsers,
        suspendedUsers,
        totalIdeas,
        publicIdeas,
        privateIdeas,
        activeCollaborations,
        signedAgreements,
        openReports,
      },
      recentAuditLogs,
    },
  });
});

export const adminListUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && ['active', 'suspended', 'banned'].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  if (req.query.q) {
    const q = String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(q, 'i');
    filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);

  return sendSuccess(res, {
    data: { users },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const adminUpdateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status, reason, role } = req.body;

  if (String(userId) === String(req.user._id)) {
    throw new AppError('Administrators cannot suspend or modify their own account status here.', 400, 'CANNOT_MODIFY_SELF');
  }

  const user = await User.findById(userId).select('+tokenVersion');
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const prevStatus = user.status;
  user.status = status;
  user.suspensionReason = status === 'active' ? '' : reason || 'Policy violation';
  if (role) {
    user.role = role;
  }
  if (status !== 'active') {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }

  await user.save();

  await recordAudit({
    actor: req.user._id,
    action: `ADMIN_USER_${status.toUpperCase()}`,
    entityType: 'admin',
    entityId: user._id,
    summary: `Changed @${user.username} status from ${prevStatus} to ${status}`,
    metadata: { reason, role: user.role },
    ip: req.ip,
  });

  await createNotification({
    recipient: user._id,
    actor: req.user._id,
    type: 'moderation',
    title: `Account Status Updated: ${status.toUpperCase()}`,
    body:
      status === 'active'
        ? 'Your account has been reactivated.'
        : `Your account status was changed to ${status}${reason ? `: ${reason}` : '.'}`,
    link: '/dashboard',
  });

  return sendSuccess(res, {
    message: `User @${user.username} updated to ${status}.`,
    data: { user },
  });
});

export const adminListReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }
  if (req.query.targetType && ['idea', 'user'].includes(req.query.targetType)) {
    filter.targetType = req.query.targetType;
  }

  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .populate('reporter', 'name username email avatarUrl')
      .populate('targetIdea', 'title ideaCode visibility status creator')
      .populate('targetUser', 'name username email status role')
      .populate('reviewedBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return sendSuccess(res, {
    data: { reports },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const adminReviewReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { status, actionTaken, resolutionNote } = req.body;

  const report = await Report.findById(reportId);
  if (!report) {
    throw new AppError('Report not found.', 404, 'REPORT_NOT_FOUND');
  }

  report.status = status;
  report.actionTaken = actionTaken;
  report.resolutionNote = resolutionNote || '';
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  await report.save();

  if (actionTaken === 'idea_removed' && report.targetIdea) {
    await Idea.findByIdAndUpdate(report.targetIdea, {
      $set: { status: 'removed', visibility: 'private' },
    });
  } else if (
    (actionTaken === 'user_suspended' || actionTaken === 'user_banned') &&
    report.targetUser &&
    String(report.targetUser) !== String(req.user._id)
  ) {
    const newStatus = actionTaken === 'user_banned' ? 'banned' : 'suspended';
    await User.findByIdAndUpdate(report.targetUser, {
      $set: { status: newStatus, suspensionReason: resolutionNote || 'Moderation enforcement' },
      $inc: { tokenVersion: 1 },
    });
  } else if (actionTaken === 'warning' && report.targetUser) {
    await createNotification({
      recipient: report.targetUser,
      actor: req.user._id,
      type: 'moderation',
      title: 'Community Guidelines Warning',
      body: resolutionNote || 'Please review IdeaSpark community and IP guidelines.',
      link: '/notifications',
    });
  }

  await recordAudit({
    actor: req.user._id,
    action: 'ADMIN_REPORT_REVIEWED',
    entityType: 'admin',
    entityId: report._id,
    idea: report.targetIdea,
    summary: `Reviewed report (${status}, action: ${actionTaken})`,
    metadata: { status, actionTaken, resolutionNote },
    ip: req.ip,
  });

  await report.populate([
    { path: 'reporter', select: 'name username' },
    { path: 'targetIdea', select: 'title ideaCode status' },
    { path: 'targetUser', select: 'name username status' },
    { path: 'reviewedBy', select: 'name username' },
  ]);

  return sendSuccess(res, {
    message: 'Moderation decision recorded.',
    data: { report },
  });
});

export const adminRemoveIdea = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const idea = await Idea.findById(ideaId);
  if (!idea) {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  idea.status = 'removed';
  idea.visibility = 'private';
  await idea.save();

  await recordAudit({
    actor: req.user._id,
    action: 'ADMIN_REMOVED_IDEA',
    entityType: 'admin',
    entityId: idea._id,
    idea: idea._id,
    summary: `Removed violating content: ${idea.ideaCode} (${idea.title})`,
    ip: req.ip,
  });

  await createNotification({
    recipient: idea.creator,
    actor: req.user._id,
    type: 'moderation',
    title: 'Content Removed by Moderation',
    body: `Your idea "${idea.title}" was removed following a policy review.`,
    link: '/my-ideas',
  });

  return sendSuccess(res, { message: 'Violating idea removed.' });
});

export const adminListCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  return sendSuccess(res, { data: { categories } });
});

export const adminCreateCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, isActive } = req.body;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const category = await Category.create({ name, slug, description, icon, isActive });

  await recordAudit({
    actor: req.user._id,
    action: 'ADMIN_CATEGORY_CREATED',
    entityType: 'admin',
    entityId: category._id,
    summary: `Created category "${category.name}"`,
    ip: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Category created.',
    data: { category },
  });
});

export const adminUpdateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { name, description, icon, isActive } = req.body;

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  if (name) {
    category.name = name;
    category.slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (description !== undefined) category.description = description;
  if (icon !== undefined) category.icon = icon;
  if (isActive !== undefined) category.isActive = isActive;

  await category.save();

  return sendSuccess(res, {
    message: 'Category updated.',
    data: { category },
  });
});

export const adminDeleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  await Category.findByIdAndDelete(categoryId);
  return sendSuccess(res, { message: 'Category removed.' });
});

export const adminGetModerationLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.entityType && req.query.entityType !== 'all') {
    filter.entityType = req.query.entityType;
  }

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .populate('actor', 'name username email role')
      .populate('idea', 'title ideaCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return sendSuccess(res, {
    data: { logs },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});
