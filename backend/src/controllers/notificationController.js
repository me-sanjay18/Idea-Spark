import { Notification } from '../models/Notification.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { buildPaginationMeta, sendSuccess } from '../utils/apiResponse.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(40, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { recipient: req.user._id };
  if (req.query.unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [total, unreadCount, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    Notification.find(filter)
      .populate('actor', 'name username avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return sendSuccess(res, {
    data: {
      notifications,
      unreadCount,
    },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: req.user._id },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
  }

  return sendSuccess(res, {
    message: 'Notification marked as read.',
    data: { notification },
  });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return sendSuccess(res, {
    message: 'All notifications marked as read.',
  });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Notification.deleteOne({ _id: id, recipient: req.user._id });
  return sendSuccess(res, { message: 'Notification removed.' });
});

