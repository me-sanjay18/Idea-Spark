import { Router } from 'express';
import { getSavedIdeas, toggleBookmark } from '../controllers/bookmarkController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getSavedIdeas);
router.post('/:ideaId', toggleBookmark);
router.delete('/:ideaId', toggleBookmark);

export default router;

