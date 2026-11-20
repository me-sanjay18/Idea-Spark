import { Router } from 'express';
import {
  getConversationMessages,
  listConversations,
  markConversationRead,
  sendMessage,
  sendMessageSchema,
  startOrGetDirectConversation,
} from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';
import { sensitiveWriteLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', listConversations);
router.post('/conversations/direct', sensitiveWriteLimiter, startOrGetDirectConversation);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post(
  '/conversations/:conversationId/messages',
  sensitiveWriteLimiter,
  validateBody(sendMessageSchema),
  sendMessage
);
router.patch('/conversations/:conversationId/read', markConversationRead);

export default router;

