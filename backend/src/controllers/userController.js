import mongoose from 'mongoose';
import { z } from 'zod';
import { Agreement } from '../models/Agreement.js';
import { Bookmark } from '../models/Bookmark.js';
import { Collaboration } from '../models/Collaboration.js';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { Idea } from '../models/Idea.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Vote } from '../models/Vote.js';
import { recordAudit, recordSecurityEvent } from '../services/auditService.js';
import { serializeIdeaCard } from '../services/ideaAccessService.js';
import { storeUploadedFile } from '../services/uploadService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from '../utils/tokens.js';

const optionalUrlSchema = z
  .string()
  .trim()
  .max(250)
  .refine((val) => !val || /^https?:\/\//i.test(val), 'URL must start with http:// or https://')
  .optional()
  .default('');

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, underscores, and hyphens')
    .optional(),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(1500).optional(),
  skills: z.array(z.string().trim().min(1).max(45)).max(25).optional(),
  interests: z.array(z.string().trim().min(1).max(45)).max(25).optional(),
  socialLinks: z
    .object({
      github: optionalUrlSchema,
      linkedin: optionalUrlSchema,
      portfolio: optionalUrlSchema,
    })
    .optional(),
  allowDirectMessagesFromPublic: z.boolean().optional(),
});

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [
    myIdeasDocs,
    bookmarkDocs,
    receivedRequests,
    sentRequests,
    activeCollaborations,
    recentNotifications,
    totalMyIdeas,
    totalBookmarks,
  ] = await Promise.all([
    Idea.find({ creator: userId, status: { $ne: 'removed' } })
      .populate('creator', 'name username avatarUrl headline')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('+shareToken'),
    Bookmark.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'idea',
        populate: { path: 'creator', select: 'name username avatarUrl headline' },
      }),
    CollaborationRequest.find({ owner: userId, status: 'pending' })
      .populate('applicant', 'name username avatarUrl headline skills')
      .populate('idea', 'title ideaCode visibility projectStage')
      .sort({ createdAt: -1 })
      .limit(6),
    CollaborationRequest.find({ applicant: userId })
      .populate('owner', 'name username avatarUrl')
      .populate('idea', 'title ideaCode visibility projectStage')
      .sort({ createdAt: -1 })
      .limit(6),
    Collaboration.find({ 'members.user': userId })
      .populate('idea', 'title ideaCode category projectStage visibility collaboratorCount')
      .populate('owner', 'name username avatarUrl')
      .populate('members.user', 'name username avatarUrl headline')
      .sort({ updatedAt: -1 })
      .limit(6),
    Notification.find({ recipient: userId })
      .populate('actor', 'name username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(8),
    Idea.countDocuments({ creator: userId, status: { $ne: 'removed' } }),
    Bookmark.countDocuments({ user: userId }),
  ]);

  const validBookmarkedIdeas = bookmarkDocs
    .filter((b) => b.idea && b.idea.status === 'active' && (b.idea.visibility === 'public' || String(b.idea.creator?._id) === String(userId)))
    .map((b) => serializeIdeaCard(b.idea, { isBookmarked: true }));

  return sendSuccess(res, {
    data: {
      stats: {
        ideasPublished: totalMyIdeas,
        bookmarkedCount: totalBookmarks,
        pendingReceivedCount: receivedRequests.length,
        activeProjectsCount: activeCollaborations.length,
      },
      myIdeas: myIdeasDocs.map((idea) => serializeIdeaCard(idea, { includeOwnerFields: true })),
      bookmarkedIdeas: validBookmarkedIdeas,
      receivedRequests,
      sentRequests,
      activeCollaborations,
      recentNotifications,
    },
  });
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const { idOrUsername } = req.params;
  const query = mongoose.Types.ObjectId.isValid(idOrUsername)
    ? { $or: [{ _id: idOrUsername }, { username: idOrUsername.toLowerCase() }] }
    : { username: idOrUsername.toLowerCase() };

  const targetUser = await User.findOne(query);
  if (!targetUser || targetUser.status === 'banned') {
    throw new AppError('User profile not found.', 404, 'USER_NOT_FOUND');
  }

  const viewerId = req.user?._id ? String(req.user._id) : null;
  const isSelf = viewerId === String(targetUser._id);
  const hasBlockedViewer = viewerId
    ? (targetUser.blockedUsers || []).some((id) => String(id) === viewerId)
    : false;

  if (hasBlockedViewer && req.user?.role !== 'admin') {
    throw new AppError('This profile is unavailable.', 403, 'USER_BLOCKED');
  }

  const viewerHasBlockedTarget = viewerId
    ? (req.user.blockedUsers || []).some((id) => String(id) === String(targetUser._id))
    : false;

  const publicIdeas = await Idea.find({
    creator: targetUser._id,
    visibility: 'public',
    status: 'active',
  })
    .populate('creator', 'name username avatarUrl headline')
    .sort({ createdAt: -1 })
    .limit(12);

  const collaborationsCount = await Collaboration.countDocuments({
    'members.user': targetUser._id,
  });

  let bookmarkedSet = new Set();
  let upvotedSet = new Set();
  if (req.user && publicIdeas.length > 0) {
    const ids = publicIdeas.map((d) => d._id);
    const [bms, votes] = await Promise.all([
      Bookmark.find({ user: req.user._id, idea: { $in: ids } }).select('idea'),
      Vote.find({ user: req.user._id, idea: { $in: ids } }).select('idea'),
    ]);
    bookmarkedSet = new Set(bms.map((b) => String(b.idea)));
    upvotedSet = new Set(votes.map((v) => String(v.idea)));
  }

  return sendSuccess(res, {
    data: {
      profile: {
        _id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        avatarUrl: targetUser.avatarUrl,
        headline: targetUser.headline,
        bio: targetUser.bio,
        skills: targetUser.skills,
        interests: targetUser.interests,
        socialLinks: targetUser.socialLinks,
        emailVerified: targetUser.emailVerified,
        allowDirectMessagesFromPublic: targetUser.allowDirectMessagesFromPublic,
        createdAt: targetUser.createdAt,
        isSelf,
        isBlockedByViewer: viewerHasBlockedTarget,
        stats: {
          publicIdeasCount: publicIdeas.length,
          collaborationsCount,
        },
      },
      ideas: publicIdeas.map((idea) =>
        serializeIdeaCard(idea, {
          isBookmarked: bookmarkedSet.has(String(idea._id)),
          isUpvoted: upvotedSet.has(String(idea._id)),
        })
      ),
    },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = req.body;
  const user = await User.findById(req.user._id);

  if (updates.username && updates.username !== user.username) {
    const taken = await User.findOne({ username: updates.username, _id: { $ne: user._id } });
    if (taken) {
      throw new AppError('That username is already taken.', 409, 'USERNAME_TAKEN');
    }
    user.username = updates.username;
  }

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.headline !== undefined) user.headline = updates.headline;
  if (updates.bio !== undefined) user.bio = updates.bio;
  if (updates.skills !== undefined) user.skills = [...new Set(updates.skills)];
  if (updates.interests !== undefined) user.interests = [...new Set(updates.interests)];
  if (updates.socialLinks !== undefined) {
    user.socialLinks = {
      github: updates.socialLinks.github ?? user.socialLinks?.github ?? '',
      linkedin: updates.socialLinks.linkedin ?? user.socialLinks?.linkedin ?? '',
      portfolio: updates.socialLinks.portfolio ?? user.socialLinks?.portfolio ?? '',
    };
  }
  if (updates.allowDirectMessagesFromPublic !== undefined) {
    user.allowDirectMessagesFromPublic = updates.allowDirectMessagesFromPublic;
  }

  await user.save();

  return sendSuccess(res, {
    message: 'Profile updated successfully.',
    data: { user },
  });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please choose an image file to upload.', 400, 'NO_FILE');
  }

  const uploaded = await storeUploadedFile(req.file, {
    folder: 'ideaspark/avatars',
    resourceType: 'image',
  });

  const user = await User.findById(req.user._id);
  user.avatarUrl = uploaded.url;
  user.avatarPublicId = uploaded.publicId;
  await user.save();

  return sendSuccess(res, {
    message: 'Profile picture updated!',
    data: { avatarUrl: user.avatarUrl, user },
  });
});

export const getSecuritySettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('+securityEvents +passwordHash')
    .populate('blockedUsers', 'name username avatarUrl headline');

  const signedAgreements = await Agreement.find({ user: req.user._id })
    .populate('idea', 'title ideaCode visibility')
    .populate('ideaOwner', 'name username')
    .sort({ acceptedAt: -1 })
    .limit(30);

  return sendSuccess(res, {
    data: {
      hasPassword: Boolean(user.passwordHash),
      githubConnected: Boolean(user.githubId),
      googleConnected: Boolean(user.googleId),
      emailVerified: user.emailVerified,
      allowDirectMessagesFromPublic: user.allowDirectMessagesFromPublic,
      blockedUsers: user.blockedUsers || [],
      securityEvents: [...(user.securityEvents || [])].reverse(),
      signedAgreements,
    },
  });
});

export const blockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  if (String(targetId) === String(req.user._id)) {
    throw new AppError('You cannot block yourself.', 400, 'INVALID_TARGET');
  }

  const target = await User.findById(targetId);
  if (!target) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { blockedUsers: target._id },
  });

  await recordSecurityEvent(req.user._id, `Blocked user @${target.username}`, req);

  return sendSuccess(res, {
    message: `@${target.username} has been blocked.`,
  });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { blockedUsers: targetId },
  });

  return sendSuccess(res, {
    message: 'User unblocked.',
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmPhrase } = req.body || {};
  const user = await User.findById(req.user._id).select('+passwordHash');

  if (user.passwordHash) {
    if (!password || !(await user.comparePassword(password))) {
      throw new AppError('Please enter your current password to confirm account deletion.', 400, 'INVALID_PASSWORD');
    }
  } else if (confirmPhrase !== 'DELETE') {
    throw new AppError('Please type DELETE to confirm permanent account removal.', 400, 'CONFIRMATION_REQUIRED');
  }

  await Promise.all([
    Idea.updateMany({ creator: user._id }, { $set: { status: 'removed', visibility: 'private' } }),
    CollaborationRequest.updateMany(
      { $or: [{ applicant: user._id }, { owner: user._id }], status: 'pending' },
      { $set: { status: 'withdrawn' } }
    ),
    Collaboration.updateMany({ 'members.user': user._id }, { $pull: { members: { user: user._id } } }),
    Bookmark.deleteMany({ user: user._id }),
    Vote.deleteMany({ user: user._id }),
    Notification.deleteMany({ recipient: user._id }),
  ]);

  await recordAudit({
    actor: null,
    action: 'USER_ACCOUNT_DELETED',
    entityType: 'user',
    entityId: user._id,
    summary: `Account @${user.username} permanently deleted by owner`,
    ip: req.ip,
  });

  await User.findByIdAndDelete(user._id);

  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

  return sendSuccess(res, {
    message: 'Your account and associated personal data have been permanently deleted.',
  });
});
