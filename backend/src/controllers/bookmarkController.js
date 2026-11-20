import { Bookmark } from '../models/Bookmark.js';
import { Idea } from '../models/Idea.js';
import { Vote } from '../models/Vote.js';
import { evaluateIdeaAccess, serializeIdeaCard } from '../services/ideaAccessService.js';
import { getSocketIO } from '../services/notificationService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { buildPaginationMeta, sendSuccess } from '../utils/apiResponse.js';

export const getSavedIdeas = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  const [total, bookmarkDocs] = await Promise.all([
    Bookmark.countDocuments({ user: req.user._id }),
    Bookmark.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'idea',
        populate: { path: 'creator', select: 'name username avatarUrl headline' },
      }),
  ]);

  const accessibleIdeas = [];
  for (const bm of bookmarkDocs) {
    if (!bm.idea) continue;
    const access = await evaluateIdeaAccess(bm.idea, req.user);
    if (access.canViewIdea) {
      accessibleIdeas.push(bm.idea);
    }
  }

  const upvotedDocs = await Vote.find({
    user: req.user._id,
    idea: { $in: accessibleIdeas.map((i) => i._id) },
  }).select('idea');
  const upvotedSet = new Set(upvotedDocs.map((v) => String(v.idea)));

  return sendSuccess(res, {
    data: {
      ideas: accessibleIdeas.map((idea) =>
        serializeIdeaCard(idea, {
          isBookmarked: true,
          isUpvoted: upvotedSet.has(String(idea._id)),
        })
      ),
    },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const toggleBookmark = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const idea = await Idea.findById(ideaId).select('+shareToken');
  if (!idea || idea.status !== 'active') {
    throw new AppError('Idea not found.', 404, 'IDEA_NOT_FOUND');
  }

  const access = await evaluateIdeaAccess(idea, req.user, String(req.body?.shareToken || ''));
  if (!access.canViewIdea) {
    throw new AppError('You do not have permission to bookmark this idea.', 403, 'FORBIDDEN_IDEA');
  }

  const existing = await Bookmark.findOne({ user: req.user._id, idea: idea._id });
  let isBookmarked = false;
  if (existing) {
    await existing.deleteOne();
    isBookmarked = false;
  } else {
    await Bookmark.create({ user: req.user._id, idea: idea._id });
    isBookmarked = true;
  }

  const bookmarkCount = await Bookmark.countDocuments({ idea: idea._id });
  idea.bookmarkCount = bookmarkCount;
  await idea.save();

  const io = getSocketIO();
  if (io) {
    io.to(`user:${String(req.user._id)}`).emit('idea:myBookmarkUpdated', {
      ideaId: String(idea._id),
      isBookmarked,
      bookmarkCount,
    });
  }

  return sendSuccess(res, {
    message: isBookmarked ? 'Saved to your bookmarks.' : 'Removed from saved ideas.',
    data: { isBookmarked, bookmarkCount },
  });
});

