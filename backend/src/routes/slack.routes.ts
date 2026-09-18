import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller.js';

const router = Router();

router.post('/connect', SlackController.connectWebhook);
router.get('/status', SlackController.getStatus);
router.post('/disconnect', SlackController.disconnect);
router.post('/test', SlackController.testAlert);
router.get('/oauth/start', SlackController.oauthStart);
router.get('/oauth/callback', SlackController.oauthCallback);

export default router;
