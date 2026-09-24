import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { db, seedAdmin } from './db/index.js';
import { kv, redisStatus } from './redis.js';
import { ipExtractorMiddleware } from './middleware/ipExtractor.js';
import { clickRouter } from './routes/click.js';
import { postbackRouter } from './routes/postback.js';
import { adminRouter } from './routes/admin/index.js';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

seedAdmin();
logger.info({ redis: redisStatus() }, `Redis: ${redisStatus().mode}`);

export const app = express();
app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(ipExtractorMiddleware);

// Логирование входящих HTTP-запросов (компактно, для публичных эндпоинтов — всегда)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (req.path === '/clk' || req.path === '/postback') {
      logger.info(
        { method: req.method, path: req.originalUrl.slice(0, 200), status: res.statusCode, ms, ip: req.clientIp },
        'http',
      );
    }
  });
  next();
});

app.use(clickRouter);
app.use(postbackRouter);

const apiRouter = express.Router();
apiRouter.use(adminRouter);
app.use('/admin', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, redis: redisStatus().mode });
});

// Отдаём собранный фронтенд, если он существует (production / простой запуск без nginx)
const distDir = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/(admin|clk|postback|health)\b).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  logger.info('Serving built frontend from ' + distDir);
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

let server: ReturnType<typeof app.listen> | undefined;

export function start(port: number): ReturnType<typeof app.listen> {
  server = app.listen(port, () => {
    logger.info(`PushTracker backend listening on :${port}`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void start(config.port);
}

async function shutdown(): Promise<void> {
  logger.info('shutting down');
  if (server) server.close();
  await kv.quit();
  db.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());