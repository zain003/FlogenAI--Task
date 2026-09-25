---
name: socketio-scaling
description: >-
  Use this skill when configuring, debugging, or verifying Socket.IO horizontal scaling across multiple NestJS backend instances with Redis Pub/Sub adapter in FEAT-002, FEAT-005, or FEAT-006.
---

# Socket.IO Horizontal Scaling & Redis Pub/Sub Runbook

This skill guides the setup, verification, and testing of real-time WebSocket communication distributed across multiple NestJS application instances using the Redis Pub/Sub Adapter.

## Architecture

```
Client A (Customer)                     Client B (Provider)
       │                                         │
       ▼                                         ▼
NestJS Instance 1 (Port 3001)           NestJS Instance 2 (Port 3002)
       │                                         │
       └───► Redis Pub/Sub Adapter Channel ◄─────┘
                         │
                    Redis Broker
```

## NestJS Redis Adapter Configuration

In `apps/backend/src/modules/socket/socket-redis.adapter.ts`:

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

In `apps/backend/src/main.ts`:
```typescript
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis();
app.useWebSocketAdapter(redisIoAdapter);
```

## Cross-Instance Verification Test

Create automated script `scripts/verify-cluster.ts` to prove that events cross between instances:

```typescript
import { io as Client } from 'socket.io-client';

async function testCrossInstance() {
  console.log('Connecting Client A to Instance 1 (port 3001)...');
  const clientA = Client('http://localhost:3001', {
    auth: { token: customerJwt },
    transports: ['websocket'],
  });

  console.log('Connecting Client B to Instance 2 (port 3002)...');
  const clientB = Client('http://localhost:3002', {
    auth: { token: providerJwt },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise((resolve) => clientA.on('connect', resolve)),
    new Promise((resolve) => clientB.on('connect', resolve)),
  ]);

  // Client B joins providers room
  const receivedPromise = new Promise((resolve) => {
    clientB.on('request:created', (data) => {
      console.log('Client B on Node 2 received event from Node 1:', data.request.id);
      resolve(data);
    });
  });

  // Client A triggers request creation on Node 1 via HTTP
  await axios.post('http://localhost:3001/api/requests', {
    title: 'Cross-Node Test',
    description: 'Verifying Redis adapter scaling',
    budget: 300,
  }, { headers: { Authorization: `Bearer ${customerJwt}` } });

  const result = await Promise.race([
    receivedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Cross-instance event timeout!')), 5000)),
  ]);

  console.log('SUCCESS: Cross-instance delivery verified across Redis adapter!');
  clientA.disconnect();
  clientB.disconnect();
}
```

## Common Issues & Fixes

1. **Sticky Sessions Required for Polling**: If using HTTP long-polling fallback, Nginx MUST use `ip_hash;`. For pure WebSockets (`transports: ['websocket']`), sticky sessions are not strictly required, but recommended during the initial handshake.
2. **Room Synchronization**: Rooms exist across instances automatically via Redis adapter channels. When a client joins `conversation:<id>` on Node 1, broadcasts to `conversation:<id>` on Node 2 will reach that client.
