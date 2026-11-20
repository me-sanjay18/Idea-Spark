import { Router } from 'express';
import { createReportSchema, listMyReports, submitReport } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { sensitiveWriteLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/mine', listMyReports);
router.post('/', sensitiveWriteLimiter, validateBody(createReportSchema), submitReport);

export default router;

