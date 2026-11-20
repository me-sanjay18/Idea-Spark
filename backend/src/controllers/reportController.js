import { z } from 'zod';
import { Idea } from '../models/Idea.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const createReportSchema = z.object({
  targetType: z.enum(['idea', 'user']),
  targetIdeaId: z.string().trim().optional().default(''),
  targetUserId: z.string().trim().optional().default(''),
  reason: z.enum([
    'stolen_or_copied',
    'ip_infringement',
    'suspicious_account',
    'spam',
    'harassment',
    'inappropriate_content',
    'other',
  ]),
  description: z.string().trim().min(15, 'Please provide at least 15 characters describing the issue').max(3000),
  evidenceUrl: z
    .string()
    .trim()
    .max(400)
    .refine((val) => !val || /^https?:\/\//i.test(val) || val.startsWith('/uploads/'), 'Please enter a valid URL')
    .optional()
    .default(''),
});

export const submitReport = asyncHandler(async (req, res) => {
  const { targetType, targetIdeaId, targetUserId, reason, description, evidenceUrl } = req.body;

  let targetIdea = null;
  let targetUser = null;

  if (targetType === 'idea') {
    if (!targetIdeaId) {
      throw new AppError('Target idea ID is required when reporting an idea.', 400, 'MISSING_IDEA_ID');
    }
    const idea = await Idea.findById(targetIdeaId);
    if (!idea) {
      throw new AppError('Reported idea was not found.', 404, 'IDEA_NOT_FOUND');
    }
    if (String(idea.creator) === String(req.user._id)) {
      throw new AppError('You cannot report your own idea.', 400, 'INVALID_TARGET');
    }
    targetIdea = idea._id;
    targetUser = idea.creator;
  } else {
    if (!targetUserId) {
      throw new AppError('Target user ID or username is required when reporting a user.', 400, 'MISSING_USER_ID');
    }
    const user = await User.findOne(
      /^[a-f\d]{24}$/i.test(targetUserId)
        ? { _id: targetUserId }
        : { username: targetUserId.toLowerCase() }
    );
    if (!user) {
      throw new AppError('Reported user was not found.', 404, 'USER_NOT_FOUND');
    }
    if (String(user._id) === String(req.user._id)) {
      throw new AppError('You cannot report your own account.', 400, 'INVALID_TARGET');
    }
    targetUser = user._id;
  }

  const report = await Report.create({
    reporter: req.user._id,
    targetType,
    targetIdea,
    targetUser,
    reason,
    description,
    evidenceUrl,
    status: 'open',
  });

  await recordAudit({
    actor: req.user._id,
    action: 'REPORT_SUBMITTED',
    entityType: 'report',
    entityId: report._id,
    idea: targetIdea,
    summary: `Submitted ${targetType} report (${reason})`,
    ip: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Your report has been logged for review by our Trust & Safety team.',
    data: { report },
  });
});

export const listMyReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ reporter: req.user._id })
    .populate('targetIdea', 'title ideaCode')
    .populate('targetUser', 'name username')
    .sort({ createdAt: -1 })
    .limit(30);

  return sendSuccess(res, {
    data: { reports },
  });
});

