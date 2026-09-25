import { Test, TestingModule } from '@nestjs/testing';
import { DistributedLockService } from './distributed-lock.service';
import { RedisService } from './redis.service';

describe('DistributedLockService', () => {
  let service: DistributedLockService;
  let redisService: RedisService;

  describe('In-Memory Fallback Mode (Redis Offline / Not Connected)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DistributedLockService,
          {
            provide: RedisService,
            useValue: {
              isReady: jest.fn().mockReturnValue(false),
              getClient: jest.fn().mockReturnValue(null),
            },
          },
        ],
      }).compile();

      service = module.get<DistributedLockService>(DistributedLockService);
      redisService = module.get<RedisService>(RedisService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should acquire lock and return a unique token', async () => {
      const key = 'mkt:lock:request:test-req-1';
      const token = await service.acquire(key, 5000);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token!.length).toBeGreaterThan(10);
    });

    it('should reject a second concurrent acquisition on the same key', async () => {
      const key = 'mkt:lock:request:test-req-2';
      const token1 = await service.acquire(key, 5000);
      expect(token1).toBeTruthy();

      const token2 = await service.acquire(key, 5000);
      expect(token2).toBeNull();
    });

    it('should release lock with correct token and allow re-acquisition', async () => {
      const key = 'mkt:lock:request:test-req-3';
      const token = await service.acquire(key, 5000);
      expect(token).toBeTruthy();

      const released = await service.release(key, token!);
      expect(released).toBe(true);

      const tokenAfterRelease = await service.acquire(key, 5000);
      expect(tokenAfterRelease).toBeTruthy();
    });

    it('should fail to release lock when provided with an incorrect token', async () => {
      const key = 'mkt:lock:request:test-req-4';
      const token = await service.acquire(key, 5000);
      expect(token).toBeTruthy();

      const released = await service.release(key, 'wrong-token-12345');
      expect(released).toBe(false);

      // Lock should still be held
      const secondAcquire = await service.acquire(key, 5000);
      expect(secondAcquire).toBeNull();
    });

    it('should allow re-acquisition after lock TTL expires', async () => {
      const key = 'mkt:lock:request:test-req-5';
      const token = await service.acquire(key, 50); // 50ms TTL
      expect(token).toBeTruthy();

      // Wait 70ms for expiration
      await new Promise((resolve) => setTimeout(resolve, 70));

      const newToken = await service.acquire(key, 5000);
      expect(newToken).toBeTruthy();
    });
  });

  describe('Redis Connected Mode', () => {
    let mockRedisClient: any;

    beforeEach(async () => {
      mockRedisClient = {
        set: jest.fn(),
        eval: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DistributedLockService,
          {
            provide: RedisService,
            useValue: {
              isReady: jest.fn().mockReturnValue(true),
              getClient: jest.fn().mockReturnValue(mockRedisClient),
            },
          },
        ],
      }).compile();

      service = module.get<DistributedLockService>(DistributedLockService);
      redisService = module.get<RedisService>(RedisService);
    });

    it('should acquire lock via Redis SET NX PX command', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      const key = 'mkt:lock:request:req-redis-1';

      const token = await service.acquire(key, 10000);

      expect(token).toBeTruthy();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        key,
        token,
        { NX: true, PX: 10000 },
      );
    });

    it('should return null when Redis returns null (already locked)', async () => {
      mockRedisClient.set.mockResolvedValue(null);
      const key = 'mkt:lock:request:req-redis-2';

      const token = await service.acquire(key, 10000);

      expect(token).toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should release lock via atomic Lua script execution', async () => {
      mockRedisClient.eval.mockResolvedValue(1);
      const key = 'mkt:lock:request:req-redis-3';
      const token = 'my-valid-token';

      const released = await service.release(key, token);

      expect(released).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('if redis.call("get", KEYS[1]) == ARGV[1] then'),
        {
          keys: [key],
          arguments: [token],
        },
      );
    });

    it('should return false if Redis Lua script returns 0 (token mismatch or already expired)', async () => {
      mockRedisClient.eval.mockResolvedValue(0);
      const key = 'mkt:lock:request:req-redis-4';

      const released = await service.release(key, 'wrong-token');

      expect(released).toBe(false);
    });
  });
});
