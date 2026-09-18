import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/google', AuthController.googleLogin);
router.get('/me', AuthController.getCurrentUser);

export default router;
