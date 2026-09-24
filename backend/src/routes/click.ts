import { Router } from 'express';
import { handleClick } from '../services/clickService.js';
import logger from '../logger.js';

export const clickRouter = Router();

clickRouter.get('/clk', async (req, res) => {
  const result = await handleClick(req);

  if (result.action === 'blocked') {
    logger.info({ ip: req.clientIp, reason: result.reason }, 'blocked click');
    // заглушка: HTTP 200, пустая страница
    res.status(200).send('');
    return;
  }

  res.redirect(302, result.redirectUrl as string);
});