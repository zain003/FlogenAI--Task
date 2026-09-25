import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  /**
   * Connects Redis Pub/Sub clients and initializes the Socket.IO Redis adapter
   * If Redis is unavailable, logs a warning and falls back to the in-memory adapter
   */
  async connectToRedis(): Promise<void> {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = process.env.REDIS_PORT || '6379';
    const redisUrl = process.env.REDIS_URL || `redis://${host}:${port}`;

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        this.logger.warn(`Redis PubClient warning: ${err.message}`);
      });
      subClient.on('error', (err) => {
        this.logger.warn(`Redis SubClient warning: ${err.message}`);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`Socket.IO Redis Adapter successfully connected to ${redisUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Redis connection failed for Socket.IO clustering (${msg}). Falling back to local in-memory adapter.`,
      );
    }
  }

  /**
   * Creates the Socket.IO server and binds the Redis adapter if available
   */
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
