import { Router } from 'express';
import {
  addMilestone,
  createCollabRequestSchema,
  deleteMilestone,
  getCollaborationWorkspace,
  listCollaborationRequests,
  listMyCollaborations,
  milestoneSchema,
  postProjectUpdate,
  projectUpdateInputSchema,
  respondCollabRequestSchema,
  respondToCollaborationRequest,
  sendCollaborationRequest,
  updateMilestone,
  updateOrRemoveMember,
  withdrawCollaborationRequest,
} from '../controllers/collaborationController.js';
import { authenticate } from '../middleware/auth.js';
import { sensitiveWriteLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/requests', listCollaborationRequests);
router.post('/requests', sensitiveWriteLimiter, validateBody(createCollabRequestSchema), sendCollaborationRequest);
router.patch('/requests/:requestId/respond', validateBody(respondCollabRequestSchema), respondToCollaborationRequest);
router.patch('/requests/:requestId/withdraw', withdrawCollaborationRequest);

router.get('/', listMyCollaborations);
router.get('/:id', getCollaborationWorkspace);
router.patch('/:id/members/:memberUserId', updateOrRemoveMember);
router.patch('/:id/settings', updateOrRemoveMember);

router.post('/:id/milestones', validateBody(milestoneSchema), addMilestone);
router.patch('/:id/milestones/:milestoneId', updateMilestone);
router.delete('/:id/milestones/:milestoneId', deleteMilestone);

router.post('/:id/updates', validateBody(projectUpdateInputSchema), postProjectUpdate);

export default router;

