import { Router } from 'express';
import {
  blockUser,
  deleteAccount,
  getDashboardOverview,
  getSecuritySettings,
  getUserProfile,
  unblockUser,
  updateProfile,
  updateProfileSchema,
  uploadAvatar,
} from '../controllers/userController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { sensitiveWriteLimiter } from '../middleware/rateLimiter.js';
import { uploadAvatarMiddleware } from '../middleware/upload.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.get('/dashboard', authenticate, getDashboardOverview);
router.get('/me/security', authenticate, getSecuritySettings);
router.patch('/me', authenticate, validateBody(updateProfileSchema), updateProfile);
router.post('/me/avatar', authenticate, sensitiveWriteLimiter, uploadAvatarMiddleware, uploadAvatar);
router.delete('/me', authenticate, sensitiveWriteLimiter, deleteAccount);

router.post('/:id/block', authenticate, blockUser);
router.delete('/:id/block', authenticate, unblockUser);

router.get('/profile/:idOrUsername', optionalAuth, getUserProfile);

export default router;

