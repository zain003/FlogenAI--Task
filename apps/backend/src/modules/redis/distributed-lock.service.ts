import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from './redis.service';

const UNLOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

interface InMemoryLockEntry {
  token: string;
  expiresAt: number;
}

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly inMemoryLocks = new Map<string, InMemoryLockEntry>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * Attempts to acquire a distributed lock on the specified key for a specified TTL (in milliseconds).
   * Returns a unique token string if acquired, or null if lock acquisition failed (already locked).
   *
   * @param key Unique lock identifier (e.g. `mkt:lock:request:<requestId>`)
   * @param ttlMs Time-to-live in milliseconds (default: 10,000ms / 10s)
   */
  async acquire(key: string, ttlMs = 10000): Promise<string | null> {
    const token = randomUUID();

    if (this.redisService.isReady()) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          const result = await client.set(key, token, {
            NX: true,
            PX: ttlMs,
          });

          if (result === 'OK') {
            this.logger.debug(`Acquired Redis lock: ${key} (token: ${token}, ttl: ${ttlMs}ms)`);
            return token;
          }

          this.logger.debug(`Redis lock already held: ${key}`);
          return null;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Redis error during lock acquire for ${key}: ${msg}. Falling back to in-memory lock.`,
        );
      }
    }

    // In-memory fallback
    const now = Date.now();
    const existing = this.inMemoryLocks.get(key);
    if (existing && existing.expiresAt > now) {
      this.logger.debug(`In-memory lock already held: ${key}`);
      return null;
    }

    this.inMemoryLocks.set(key, { token, expiresAt: now + ttlMs });
    this.logger.debug(`Acquired in-memory lock: ${key} (token: ${token}, ttl: ${ttlMs}ms)`);
    return token;
  }

  /**
   * Releases a distributed lock using an atomic Lua script verifying that the caller holds the token.
   * Returns true if released successfully, false otherwise.
   *
   * @param key Unique lock identifier
   * @param token The token returned when the lock was acquired
   */
  async release(key: string, token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    if (this.redisService.isReady()) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          const result = await client.eval(UNLOCK_LUA_SCRIPT, {
            keys: [key],
            arguments: [token],
          });

          const released = Number(result) === 1;
          if (released) {
            this.logger.debug(`Released Redis lock: ${key}`);
          } else {
            this.logger.debug(`Redis lock release failed or token mismatch for key: ${key}`);
          }
          return released;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Redis error during lock release for ${key}: ${msg}`);
      }
    }

    // In-memory fallback
    const existing = this.inMemoryLocks.get(key);
    if (!existing) {
      return false;
    }

    if (existing.token === token) {
      this.inMemoryLocks.delete(key);
      this.logger.debug(`Released in-memory lock: ${key}`);
      return true;
    }

    return false;
  }

  /**
   * Alias for acquire()
   */
  async acquireLock(key: string, ttlMs = 10000): Promise<string | null> {
    return this.acquire(key, ttlMs);
  }

  /**
   * Alias for release()
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    return this.release(key, token);
  }
}
