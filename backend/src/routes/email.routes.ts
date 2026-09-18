import { Router } from 'express';
import { EmailController } from '../controllers/email.controller.js';

const router = Router();

router.post('/schedule', EmailController.schedule);
router.post('/schedule-batch', EmailController.scheduleBatch);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.delete('/:id', EmailController.cancel);
router.get('/stats', EmailController.getStats);
router.post('/reset-rate-limit', EmailController.resetRateLimit);

export default router;
