import { Notification } from '../models/Notification.js';

let ioInstance = null;

export function registerNotificationSocket(io) {
  ioInstance = io;
}

export function getSocketIO() {
  return ioInstance;
}

export async function createNotification({
  recipient,
  actor = null,
  type,
  title,
  body,
  link = '/dashboard',
  metadata = {},
}) {
  if (!recipient) return null;
  if (actor && String(actor) === String(recipient)) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    actor,
    type,
    title,
    body,
    link,
    metadata,
  });

  const populated = await notification.populate('actor', 'name username avatarUrl');

  if (ioInstance) {
    ioInstance.to(`user:${String(recipient)}`).emit('notification:new', populated);
  }

  return populated;
}

