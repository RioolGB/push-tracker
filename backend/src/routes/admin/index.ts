import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authRouter } from './auth.js';
import { offersRouter } from './offers.js';
import { listsRouter } from './lists.js';
import { statsRouter } from './stats.js';
import { dataRouter } from './data.js';
import { spendRouter } from './spend.js';

export const adminRouter = Router();

adminRouter.use(authRouter);

adminRouter.use(requireAuth);
adminRouter.use('/offers', offersRouter);
adminRouter.use('/stats', statsRouter);
adminRouter.use('/spend', spendRouter);
adminRouter.use(listsRouter);
adminRouter.use(dataRouter);