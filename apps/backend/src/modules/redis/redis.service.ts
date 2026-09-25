import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private isClientReady = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST') || process.env.REDIS_HOST || '127.0.0.1';
    const port = this.configService.get<string>('REDIS_PORT') || process.env.REDIS_PORT || '6379';
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      process.env.REDIS_URL ||
      `redis://${host}:${port}`;

    try {
      this.client = createClient({ url: redisUrl }) as RedisClientType;

      this.client.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
        this.isClientReady = false;
      });

      this.client.on('ready', () => {
        this.logger.log(`Redis client connected and ready at ${redisUrl}`);
        this.isClientReady = true;
      });

      this.client.on('end', () => {
        this.isClientReady = false;
      });

      await this.client.connect();
      this.isClientReady = true;
      this.logger.log(`Connected to Redis at ${redisUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to connect to Redis (${msg}). Operating in local fallback mode.`,
      );
      this.isClientReady = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isClientReady) {
      try {
        await this.client.quit();
        this.logger.log('Redis client disconnected cleanly');
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis client: ${err}`);
      }
    }
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  isReady(): boolean {
    return this.isClientReady && this.client !== null;
  }
}
