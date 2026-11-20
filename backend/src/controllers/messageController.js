import { z } from 'zod';
import { Collaboration } from '../models/Collaboration.js';
import { CollaborationRequest } from '../models/CollaborationRequest.js';
import { Conversation } from '../models/Conversation.js';
import { Idea } from '../models/Idea.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { createNotification, getSocketIO } from '../services/notificationService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { buildPaginationMeta, sendSuccess } from '../utils/apiResponse.js';

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});

async function canUsersMessageDirectly(senderId, recipientUser) {
  // Check blocks in both directions
  const sender = await User.findById(senderId).select('blockedUsers');
  if (!sender || !recipientUser || recipientUser.status !== 'active') {
    return { allowed: false, reason: 'Recipient is unavailable.' };
  }

  const senderBlockedRecipient = (sender.blockedUsers || []).some(
    (id) => String(id) === String(recipientUser._id)
  );
  const recipientBlockedSender = (recipientUser.blockedUsers || []).some(
    (id) => String(id) === String(senderId)
  );
  if (senderBlockedRecipient || recipientBlockedSender) {
    return { allowed: false, reason: 'Direct messaging between these accounts is blocked.' };
  }

  // 1. Are they teammates in any Collaboration workspace?
  const sharedCollab = await Collaboration.exists({
    $and: [{ 'members.user': senderId }, { 'members.user': recipientUser._id }],
  });
  if (sharedCollab) {
    return { allowed: true };
  }

  // 2. Is there a pending or accepted CollaborationRequest between them?
  const sharedRequest = await CollaborationRequest.exists({
    status: { $in: ['pending', 'accepted'] },
    $or: [
      { applicant: senderId, owner: recipientUser._id },
      { applicant: recipientUser._id, owner: senderId },
    ],
  });
  if (sharedRequest) {
    return { allowed: true };
  }

  // 3. Do NOT allow strangers to message private project members!
  // Only allow public inquiry if recipient explicitly enables public DMs AND has published a public active idea.
  if (recipientUser.allowDirectMessagesFromPublic) {
    const hasPublicIdea = await Idea.exists({
      creator: recipientUser._id,
      visibility: 'public',
      status: 'active',
    });
    if (hasPublicIdea) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason:
      'Direct messaging is restricted to active collaborators, collaboration applicants, or public idea creators.',
  };
}

function assertConversationParticipant(conversation, userId) {
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'CONVERSATION_NOT_FOUND');
  }
  const isMember = conversation.participants.some(
    (p) => String(p?._id || p) === String(userId)
  );
  if (!isMember) {
    throw new AppError('Access denied: you are not a member of this conversation.', 403, 'FORBIDDEN_CONVERSATION');
  }
}

export const listConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const conversations = await Conversation.find({ participants: userId })
    .populate('participants', 'name username avatarUrl headline')
    .populate('idea', 'title ideaCode visibility')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'name username' },
    })
    .sort({ lastMessageAt: -1 });

  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId },
      });
      return {
        ...conv.toObject(),
        unreadCount,
      };
    })
  );

  return sendSuccess(res, {
    data: { conversations: enriched },
  });
});

export const startOrGetDirectConversation = asyncHandler(async (req, res) => {
  const { recipientId } = req.body;
  if (!recipientId) {
    throw new AppError('Recipient user ID is required.', 400, 'MISSING_RECIPIENT');
  }

  if (String(recipientId) === String(req.user._id)) {
    throw new AppError('You cannot message yourself.', 400, 'INVALID_RECIPIENT');
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new AppError('Recipient not found.', 404, 'USER_NOT_FOUND');
  }

  // Check if an authorized direct conversation already exists
  let conversation = await Conversation.findOne({
    type: 'direct',
    participants: { $all: [req.user._id, recipient._id], $size: 2 },
  })
    .populate('participants', 'name username avatarUrl headline')
    .populate('lastMessage');

  const permission = await canUsersMessageDirectly(req.user._id, recipient);
  if (!permission.allowed) {
    throw new AppError(permission.reason, 403, 'FORBIDDEN_STRANGER_MESSAGE');
  }

  if (!conversation) {
    conversation = await Conversation.create({
      type: 'direct',
      participants: [req.user._id, recipient._id],
      lastMessageAt: new Date(),
    });
    await conversation.populate('participants', 'name username avatarUrl headline');
  }

  return sendSuccess(res, {
    statusCode: 200,
    data: { conversation },
  });
});

export const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(80, Math.max(1, Number.parseInt(req.query.limit, 10) || 40));
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findById(conversationId)
    .populate('participants', 'name username avatarUrl headline')
    .populate('idea', 'title ideaCode visibility');

  assertConversationParticipant(conversation, req.user._id);

  const [total, messagesDesc] = await Promise.all([
    Message.countDocuments({ conversation: conversation._id }),
    Message.find({ conversation: conversation._id })
      .populate('sender', 'name username avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  // Mark unread messages as read
  const unreadIds = messagesDesc
    .filter(
      (m) =>
        String(m.sender?._id || m.sender) !== String(req.user._id) &&
        !(m.readBy || []).some((r) => String(r.user) === String(req.user._id))
    )
    .map((m) => m._id);

  if (unreadIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unreadIds } },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );

    const io = getSocketIO();
    if (io) {
      const readTargetRooms = [
        `conversation:${String(conversation._id)}`,
        ...conversation.participants.map((p) => `user:${String(p?._id || p)}`),
      ];
      io.to(readTargetRooms).emit('messages:read', {
        conversationId: String(conversation._id),
        userId: String(req.user._id),
        readAt: new Date(),
      });
    }
  }

  return sendSuccess(res, {
    data: {
      conversation,
      messages: messagesDesc.reverse(),
    },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { content } = req.body;

  const conversation = await Conversation.findById(conversationId).populate(
    'participants',
    'name username avatarUrl blockedUsers status'
  );
  assertConversationParticipant(conversation, req.user._id);

  // If direct conversation, verify neither user has blocked the other
  if (conversation.type === 'direct') {
    const other = conversation.participants.find((p) => String(p._id) !== String(req.user._id));
    if (other) {
      const blockedByOther = (other.blockedUsers || []).some((id) => String(id) === String(req.user._id));
      const blockedBySelf = (req.user.blockedUsers || []).some((id) => String(id) === String(other._id));
      if (blockedByOther || blockedBySelf || other.status !== 'active') {
        throw new AppError('Cannot deliver message to this recipient.', 403, 'MESSAGE_BLOCKED');
      }
    }
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    content,
    readBy: [{ user: req.user._id, readAt: new Date() }],
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  const populatedMsg = await message.populate('sender', 'name username avatarUrl');

  const io = getSocketIO();
  if (io) {
    const targetRooms = [
      `conversation:${String(conversation._id)}`,
      ...conversation.participants.map((p) => `user:${String(p?._id || p)}`),
    ];
    io.to(targetRooms).emit('message:new', populatedMsg);
  }

  for (const participant of conversation.participants) {
    if (String(participant._id) !== String(req.user._id)) {
      if (io) {
        io.to(`user:${String(participant._id)}`).emit('conversation:updated', {
          conversationId: String(conversation._id),
          lastMessage: populatedMsg,
        });
      }
      await createNotification({
        recipient: participant._id,
        actor: req.user._id,
        type: 'new_message',
        title:
          conversation.type === 'team'
            ? `New message in ${conversation.title || 'Team Chat'}`
            : `New message from ${req.user.name}`,
        body: content.length > 100 ? `${content.slice(0, 97)}...` : content,
        link: `/messages/${conversation._id}`,
        metadata: { conversationId: conversation._id },
      });
    }
  }

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Message sent.',
    data: { message: populatedMsg },
  });
});

export const markConversationRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await Conversation.findById(conversationId);
  assertConversationParticipant(conversation, req.user._id);

  await Message.updateMany(
    {
      conversation: conversation._id,
      'readBy.user': { $ne: req.user._id },
    },
    {
      $push: { readBy: { user: req.user._id, readAt: new Date() } },
    }
  );

  const io = getSocketIO();
  if (io) {
    const readRooms = [
      `conversation:${String(conversation._id)}`,
      ...conversation.participants.map((p) => `user:${String(p?._id || p)}`),
    ];
    io.to(readRooms).emit('messages:read', {
      conversationId: String(conversation._id),
      userId: String(req.user._id),
      readAt: new Date(),
    });
  }

  return sendSuccess(res, { message: 'Conversation marked as read.' });
});

