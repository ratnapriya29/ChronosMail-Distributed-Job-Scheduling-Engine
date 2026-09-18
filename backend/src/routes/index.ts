import { Router } from 'express';
import emailRoutes from './email.routes.js';
import searchRoutes from './search.routes.js';
import slackRoutes from './slack.routes.js';
import authRoutes from './auth.routes.js';

const apiRouter = Router();

apiRouter.use('/emails', emailRoutes);
apiRouter.use('/search', searchRoutes);
apiRouter.use('/slack', slackRoutes);
apiRouter.use('/auth', authRoutes);

export default apiRouter;
