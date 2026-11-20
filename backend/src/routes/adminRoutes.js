import { Router } from 'express';
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminGetModerationLogs,
  adminListCategories,
  adminListReports,
  adminListUsers,
  adminRemoveIdea,
  adminReviewReport,
  adminUpdateCategory,
  adminUpdateUserStatus,
  categoryInputSchema,
  getAdminOverview,
  reviewReportSchema,
  updateUserStatusSchema,
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', adminListUsers);
router.patch('/users/:userId/status', validateBody(updateUserStatusSchema), adminUpdateUserStatus);

router.get('/reports', adminListReports);
router.patch('/reports/:reportId', validateBody(reviewReportSchema), adminReviewReport);

router.delete('/ideas/:ideaId', adminRemoveIdea);

router.get('/categories', adminListCategories);
router.post('/categories', validateBody(categoryInputSchema), adminCreateCategory);
router.patch('/categories/:categoryId', adminUpdateCategory);
router.delete('/categories/:categoryId', adminDeleteCategory);

router.get('/logs', adminGetModerationLogs);

export default router;

