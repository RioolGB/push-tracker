import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino/file',
    options: { destination: 1 }, // stdout
  },
];

if (config.logFileEnabled) {
  fs.mkdirSync(config.logDir, { recursive: true });
  targets.push({
    target: 'pino/file',
    options: { destination: path.join(config.logDir, 'app.log'), mkdir: true },
  });
}

const transport = pino.transport({ targets });

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);

export default logger;