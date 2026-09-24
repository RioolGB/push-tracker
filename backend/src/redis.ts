import { Redis as IORedis } from 'ioredis';
import { config } from './config.js';
import logger from './logger.js';

export interface KVS {
  incr(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  del(key: string): Promise<void>;
  quit(): Promise<void>;
}

class MemoryKVS implements KVS {
  private store = new Map<string, { value: string; expiresAt: number }>();

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.sweep();
    return this.store.get(key)?.value ?? null;
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) entry.expiresAt = Date.now() + seconds * 1000;
  }

  async incr(key: string): Promise<number> {
    this.sweep();
    const entry = this.store.get(key);
    if (!entry) {
      this.store.set(key, { value: '1', expiresAt: 0 });
      return 1;
    }
    const next = (Number.parseInt(entry.value, 10) || 0) + 1;
    entry.value = String(next);
    return next;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async quit(): Promise<void> {
    this.store.clear();
  }
}

let client: IORedis | null = null;
let memory: MemoryKVS | null = null;
let usingMemory = false;

function buildRedis(): IORedis {
  const redis = new IORedis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on('error', (err: Error) => {
    logger.warn({ err }, 'Redis error, falling back to in-memory store');
    usingMemory = true;
  });
  return redis;
}

export const kv: KVS = {
  async incr(key) {
    if (!usingMemory) {
      try {
        if (!client) client = buildRedis();
        return await client.incr(key);
      } catch {
        usingMemory = true;
      }
    }
    return (memory ??= new MemoryKVS()).incr(key);
  },
  async get(key) {
    if (!usingMemory) {
      try {
        if (!client) client = buildRedis();
        return await client.get(key);
      } catch {
        usingMemory = true;
      }
    }
    return (memory ??= new MemoryKVS()).get(key);
  },
  async setex(key, seconds, value) {
    if (!usingMemory) {
      try {
        if (!client) client = buildRedis();
        await client.setex(key, seconds, value);
        return;
      } catch {
        usingMemory = true;
      }
    }
    await (memory ??= new MemoryKVS()).setex(key, seconds, value);
  },
  async expire(key, seconds) {
    if (!usingMemory) {
      try {
        if (!client) client = buildRedis();
        await client.expire(key, seconds);
        return;
      } catch {
        usingMemory = true;
      }
    }
    await (memory ??= new MemoryKVS()).expire(key, seconds);
  },
  async del(key) {
    if (!usingMemory) {
      try {
        if (!client) client = buildRedis();
        await client.del(key);
        return;
      } catch {
        usingMemory = true;
      }
    }
    await (memory ??= new MemoryKVS()).del(key);
  },
  async quit() {
    await memory?.quit();
    if (client) {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
      client = null;
    }
  },
};

export function redisStatus(): { mode: 'redis' | 'memory' } {
  return { mode: usingMemory ? 'memory' : 'redis' };
}