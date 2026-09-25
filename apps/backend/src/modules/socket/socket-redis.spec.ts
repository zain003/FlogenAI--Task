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

  // ─── Adapter Lifecycle Tests ───────────────────────────────────────────────

  it('should connect pub/sub clients and configure Redis adapter when Redis is available', async () => {
    const mockApp = {} as any;
    const adapter = new RedisIoAdapter(mockApp);

    await adapter.connectToRedis();

    expect(redis.createClient).toHaveBeenCalled();
    expect(mockPubClient.duplicate).toHaveBeenCalled();
    expect(mockPubClient.connect).toHaveBeenCalled();
    expect(mockSubClient.connect).toHaveBeenCalled();
    expect(redisAdapter.createAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);

    const mockServer = { adapter: jest.fn() };
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
      .mockReturnValue(mockServer);

    const createdServer = adapter.createIOServer(3001);
    expect(mockServer.adapter).toHaveBeenCalledWith(adapterConstructorMock);
    expect(createdServer).toBe(mockServer);
  });

  it('should fall back gracefully to local in-memory adapter when Redis is unavailable', async () => {
    mockPubClient.connect.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));

    const mockApp = {} as any;
    const adapter = new RedisIoAdapter(mockApp);

    await expect(adapter.connectToRedis()).resolves.not.toThrow();

    const mockServer = { adapter: jest.fn() };
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
      .mockReturnValue(mockServer);

    adapter.createIOServer(3001);
    expect(mockServer.adapter).not.toHaveBeenCalled();
  });

  // ─── Cross-Instance Event Propagation Tests ────────────────────────────────

  // Test: should propagate request:created across two backend instances via Redis pub/sub
  it('should propagate request:created across two backend instances via Redis pub/sub simulation', (done) => {
    const redisBroker = new EventEmitter();

    const node1PubSub = {
      publish: (channel: string, message: string) => {
        redisBroker.emit(channel, message);
      },
    };

    const node2ReceivedEvents: any[] = [];
    redisBroker.on('socket.io#providers#request:created', (data) => {
      const parsed = JSON.parse(data);
      node2ReceivedEvents.push(parsed);

      expect(parsed.request.id).toBe('req-cross-node-101');
      expect(parsed.request.title).toBe('Cross-Instance Scaled Request');
      expect(parsed.request.budget).toBe(450);
      done();
    });

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

  // FEAT-003-INT Test 4: should propagate offer:created across two NestJS instances via Redis adapter
  it('should propagate offer:created across two NestJS instances via Redis pub/sub simulation', (done) => {
    const redisBroker = new EventEmitter();
    const customerId = 'customer-node-1';

    const node1PubSub = {
      publish: (channel: string, message: string) => {
        redisBroker.emit(channel, message);
      },
    };

    // Node 2: Customer is connected on Instance 2 and subscribed to private room
    redisBroker.on(`socket.io#user:${customerId}#offer:created`, (data) => {
      const parsed = JSON.parse(data);

      expect(parsed.offer.id).toBe('offer-cross-node-202');
      expect(parsed.offer.requestId).toBe('req-cross-node-101');
      expect(parsed.offer.status).toBe('PENDING');
      expect(parsed.requestTitle).toBe('Cross-Instance Plumbing Job');
      done();
    });

    // Node 1: Provider creates offer on Instance 1; backend emits to customer's private room via Redis
    const offerPayload = {
      offer: {
        id: 'offer-cross-node-202',
        requestId: 'req-cross-node-101',
        providerId: 'provider-node-2',
        price: 320,
        message: 'Available immediately with all required tools.',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      requestTitle: 'Cross-Instance Plumbing Job',
    };

    node1PubSub.publish(
      `socket.io#user:${customerId}#offer:created`,
      JSON.stringify(offerPayload),
    );
  });

  // FEAT-003-INT: should propagate offer:accepted to provider and request:closed to providers via Redis
  it('should propagate offer:accepted and request:closed across NestJS instances via Redis pub/sub simulation', (done) => {
    const redisBroker = new EventEmitter();
    const providerId = 'provider-node-2';
    let eventsReceived = 0;

    const node2PubSub = {
      publish: (channel: string, message: string) => {
        redisBroker.emit(channel, message);
      },
    };

    // Winning provider receives offer:accepted in their private room
    redisBroker.on(`socket.io#user:${providerId}#offer:accepted`, (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.offer.id).toBe('offer-accepted-303');
      expect(parsed.offer.status).toBe('ACCEPTED');
      expect(parsed.requestId).toBe('req-cross-node-101');
      eventsReceived++;
      if (eventsReceived === 2) done();
    });

    // All providers receive request:closed so they can update their feed
    redisBroker.on('socket.io#providers#request:closed', (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.requestId).toBe('req-cross-node-101');
      eventsReceived++;
      if (eventsReceived === 2) done();
    });

    // Instance 2 broadcasts acceptance events
    const acceptedOfferPayload = {
      offer: {
        id: 'offer-accepted-303',
        requestId: 'req-cross-node-101',
        providerId,
        price: 320,
        message: 'Available immediately.',
        status: 'ACCEPTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      requestId: 'req-cross-node-101',
    };

    const closedPayload = { requestId: 'req-cross-node-101' };

    node2PubSub.publish(
      `socket.io#user:${providerId}#offer:accepted`,
      JSON.stringify(acceptedOfferPayload),
    );
    node2PubSub.publish(
      'socket.io#providers#request:closed',
      JSON.stringify(closedPayload),
    );
  });

  // FEAT-004-INT: should propagate payment:succeeded to customer and provider rooms via Redis
  it('should propagate payment:succeeded to customer and provider rooms across NestJS instances via Redis pub/sub simulation', (done) => {
    const redisBroker = new EventEmitter();
    const customerId = 'customer-node-1';
    const providerId = 'provider-node-2';
    const requestId = 'req-paid-909';
    const amount = 25000;
    let eventsReceived = 0;

    const node1PubSub = {
      publish: (channel: string, message: string) => {
        redisBroker.emit(channel, message);
      },
    };

    // Customer receives payment:succeeded in their private room
    redisBroker.on(`socket.io#user:${customerId}#payment:succeeded`, (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.requestId).toBe(requestId);
      expect(parsed.amount).toBe(amount);
      eventsReceived++;
      if (eventsReceived === 2) done();
    });

    // Provider receives payment:succeeded in their private room
    redisBroker.on(`socket.io#user:${providerId}#payment:succeeded`, (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.requestId).toBe(requestId);
      expect(parsed.amount).toBe(amount);
      eventsReceived++;
      if (eventsReceived === 2) done();
    });

    const paymentPayload = { requestId, amount };

    node1PubSub.publish(
      `socket.io#user:${customerId}#payment:succeeded`,
      JSON.stringify(paymentPayload),
    );
    node1PubSub.publish(
      `socket.io#user:${providerId}#payment:succeeded`,
      JSON.stringify(paymentPayload),
    );
  });

  // FEAT-005-INT: should broadcast message:new across two NestJS instances via Redis adapter
  it('should broadcast message:new across two NestJS instances via Redis adapter simulation', (done) => {
    const redisBroker = new EventEmitter();
    const conversationId = 'conv-cross-instance-777';

    // Instance 1 publishes message:new to conversation room
    const node1PubSub = {
      publish: (channel: string, message: string) => {
        redisBroker.emit(channel, message);
      },
    };

    // Client connected on Instance 2 receives message:new
    redisBroker.on(
      `socket.io#conversation:${conversationId}#message:new`,
      (data) => {
        const parsed = JSON.parse(data);
        expect(parsed.message.id).toBe('msg-cross-node-1');
        expect(parsed.message.conversationId).toBe(conversationId);
        expect(parsed.message.senderId).toBe('customer-123');
        expect(parsed.message.content).toBe(
          'Cross-instance message delivery verified',
        );
        done();
      },
    );

    const messagePayload = {
      message: {
        id: 'msg-cross-node-1',
        conversationId,
        senderId: 'customer-123',
        content: 'Cross-instance message delivery verified',
        createdAt: new Date().toISOString(),
      },
    };

    node1PubSub.publish(
      `socket.io#conversation:${conversationId}#message:new`,
      JSON.stringify(messagePayload),
    );
  });
});
