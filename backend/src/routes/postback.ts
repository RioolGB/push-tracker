import crypto from 'crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { handlePostback, parsePostback } from '../services/postbackService.js';
import logger from '../logger.js';

export const postbackRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

postbackRouter.get('/postback', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  logger.info({ ip: req.clientIp, click_id: req.query.click_id }, 'postback received');

  if (!token || !safeEqual(token, config.postbackToken)) {
    logger.warn({ ip: req.clientIp }, 'postback rejected: bad token');
    res.send('ERROR');
    return;
  }

  const input = await parsePostback(req.query as Record<string, unknown>);
  if (!input) {
    res.send('ERROR');
    return;
  }
  const result = await handlePostback(input);
  res.send(result);
});