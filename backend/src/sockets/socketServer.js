import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { registerNotificationSocket } from '../services/notificationService.js';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/tokens.js';

function parseCookies(cookieHeader = '') {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (
          !origin ||
          origin === env.clientUrl ||
          (!env.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
        ) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      const token = cookies[AUTH_COOKIE_NAME];
      if (!token) {
        socket.user = null;
        return next();
      }
      const decoded = verifyAuthToken(token);
      const user = await User.findById(decoded.sub).select('name username avatarUrl status tokenVersion');
      if (!user || user.status !== 'active' || (user.tokenVersion || 0) !== (decoded.tv || 0)) {
        socket.user = null;
        return next();
      }
      socket.user = user;
      return next();
    } catch {
      socket.user = null;
      return next();
    }
  });

  io.on('connection', async (socket) => {
    socket.join('public:feed');

    if (!socket.user) {
      return;
    }

    const userId = String(socket.user._id);
    socket.join(`user:${userId}`);

    // Join rooms for conversations the user is an authorized member of
    try {
      const conversations = await Conversation.find({ participants: socket.user._id }).select('_id');
      for (const conv of conversations) {
        socket.join(`conversation:${String(conv._id)}`);
      }
    } catch {
      // Non-fatal
    }

    socket.on('conversation:join', async (conversationId) => {
      if (!conversationId) return;
      try {
        const exists = await Conversation.exists({
          _id: conversationId,
          participants: socket.user._id,
        });
        if (exists) {
          socket.join(`conversation:${String(conversationId)}`);
        }
      } catch {
        // Ignore invalid IDs
      }
    });

    socket.on('typing:start', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      try {
        const exists = await Conversation.exists({
          _id: conversationId,
          participants: socket.user._id,
        });
        if (exists) {
          socket.to(`conversation:${String(conversationId)}`).emit('typing:update', {
            conversationId: String(conversationId),
            user: { _id: userId, name: socket.user.name },
            isTyping: true,
          });
        }
      } catch {
        // Ignore invalid IDs
      }
    });

    socket.on('typing:stop', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(`conversation:${String(conversationId)}`).emit('typing:update', {
        conversationId: String(conversationId),
        user: { _id: userId, name: socket.user.name },
        isTyping: false,
      });
    });
  });

  registerNotificationSocket(io);
  return io;
}

