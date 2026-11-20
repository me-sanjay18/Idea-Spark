import { Router } from 'express';
import {
  aiAssistSchema,
  assistIdeaWriting,
  createIdea,
  createIdeaSchema,
  deleteIdea,
  downloadIdeaAttachment,
  downloadIdeaCustomNda,
  exploreIdeas,
  getAiAssistantStatus,
  getCategories,
  getIdeaById,
  getIdeaRecords,
  getLandingData,
  getMyIdeas,
  manageIdeaAccessAndStatus,
  previewUploadedIdeaFile,
  signConfidentialityAgreement,
  toggleUpvote,
  updateIdea,
  updateIdeaSchema,
  uploadIdeaFile,
} from '../controllers/ideaController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { sensitiveWriteLimiter } from '../middleware/rateLimiter.js';
import { uploadDocumentMiddleware } from '../middleware/upload.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.get('/landing', optionalAuth, getLandingData);
router.get('/categories', getCategories);
router.get('/ai/status', authenticate, getAiAssistantStatus);
router.post('/ai/assist', authenticate, sensitiveWriteLimiter, validateBody(aiAssistSchema), assistIdeaWriting);
router.get('/mine', authenticate, getMyIdeas);
router.post('/upload', authenticate, sensitiveWriteLimiter, uploadDocumentMiddleware, uploadIdeaFile);
router.get('/uploads/preview', authenticate, previewUploadedIdeaFile);

router.get('/', optionalAuth, exploreIdeas);
router.post('/', authenticate, sensitiveWriteLimiter, validateBody(createIdeaSchema), createIdea);

router.get('/:id', optionalAuth, getIdeaById);
router.get('/:id/attachments/:attachmentId', optionalAuth, downloadIdeaAttachment);
router.get('/:id/nda-document', optionalAuth, downloadIdeaCustomNda);
router.put('/:id', authenticate, validateBody(updateIdeaSchema), updateIdea);
router.patch('/:id', authenticate, validateBody(updateIdeaSchema), updateIdea);
router.patch('/:id/access', authenticate, manageIdeaAccessAndStatus);
router.delete('/:id', authenticate, deleteIdea);

router.post('/:id/nda', authenticate, sensitiveWriteLimiter, signConfidentialityAgreement);
router.get('/:id/records', authenticate, getIdeaRecords);
router.post('/:id/vote', authenticate, toggleUpvote);

export default router;
