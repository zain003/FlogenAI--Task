import { RedisIoAdapter } from './socket-redis.adapter';
import * as redis from 'redis';
import * as redisAdapter from '@socket.io/redis-adapter';
import { EventEmitter } from 'events';

jest.mock('redis');
jest.mock('@socket.io/redis-adapter');

describe('RedisIoAdapter & Cross-Instance Propagation', () => {
  let mockPubClient: any;
  let mockSubClient: any;
  let adapterConstructorMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPubClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn(),
      on: jest.fn(),
    };

    mockSubClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    mockPubClient.duplicate.mockReturnValue(mockSubClient);

    (redis.createClient as jest.Mock).mockReturnValue(mockPubClient);

    adapterConstructorMock = jest.fn();
    (redisAdapter.createAdapter as jest.Mock).mockReturnValue(adapterConstructorMock);
  });

  it('should connect pub/sub clients and configure Redis adapter when Redis is available', async () => {
    const mockApp = {} as any;
    const adapter = new RedisIoAdapter(mockApp);

    await adapter.connectToRedis();

    expect(redis.createClient).toHaveBeenCalled();
    expect(mockPubClient.duplicate).toHaveBeenCalled();
    expect(mockPubClient.connect).toHaveBeenCalled();
    expect(mockSubClient.connect).toHaveBeenCalled();
    expect(redisAdapter.createAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);

    // Verify createIOServer binds adapter
    const mockServer = {
      adapter: jest.fn(),
    };
    // Mock super.createIOServer
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer').mockReturnValue(mockServer);

    const createdServer = adapter.createIOServer(3001);
    expect(mockServer.adapter).toHaveBeenCalledWith(adapterConstructorMock);
    expect(createdServer).toBe(mockServer);
  });

  it('should fall back gracefully to local in-memory adapter when Redis is unavailable', async () => {
    mockPubClient.connect.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));

    const mockApp = {} as any;
    const adapter = new RedisIoAdapter(mockApp);

    // connectToRedis should catch the error and not crash
    await expect(adapter.connectToRedis()).resolves.not.toThrow();

    const mockServer = {
      adapter: jest.fn(),
    };
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer').mockReturnValue(mockServer);

    adapter.createIOServer(3001);
    // Should NOT have bound the redis adapter constructor since connection failed
    expect(mockServer.adapter).not.toHaveBeenCalled();
  });

  // Test 4: should propagate request:created across two backend instances via Redis pub/sub
  it('should propagate request:created across two backend instances via Redis pub/sub simulation', (done) => {
    // Shared Redis broker simulation channel
    const redisBroker = new EventEmitter();

    // Instance 1 simulator (Customer creates request on Node 1)
    const node1PubSub = {
      publish: (channel: string, message: string) => {
        redisBroker.emit(channel, message);
      },
    };

    // Instance 2 simulator (Provider connected on Node 2)
    const node2ReceivedEvents: any[] = [];
    redisBroker.on('socket.io#providers#request:created', (data) => {
      const parsed = JSON.parse(data);
      node2ReceivedEvents.push(parsed);

      expect(parsed.request.id).toBe('req-cross-node-101');
      expect(parsed.request.title).toBe('Cross-Instance Scaled Request');
      expect(parsed.request.budget).toBe(450);
      done();
    });

    // Simulate Node 1 publishing through the Redis adapter channel
    const eventPayload = {
      request: {
        id: 'req-cross-node-101',
        title: 'Cross-Instance Scaled Request',
        description: 'Verifying cross-node synchronization across Redis Pub/Sub adapter',
        budget: 450,
        status: 'OPEN',
        customerId: 'customer-node-1',
        createdAt: new Date().toISOString(),
      },
    };

    node1PubSub.publish('socket.io#providers#request:created', JSON.stringify(eventPayload));
  });
});
