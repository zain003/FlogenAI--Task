# Architecture Context — Real-Time Service Marketplace

## Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router, TypeScript, React 19) | Minimal, responsive UI for Customer & Provider workflows |
| **Backend** | NestJS (TypeScript, Node.js) | Dual-instance REST API & Socket.IO real-time microservices |
| **Load Balancer** | Nginx | Reverse proxy distributing traffic between NestJS Instance 1 and 2 |
| **Database** | MongoDB (Mongoose ODM) | Primary persistent data store for users, requests, offers, payments, chats |
| **Broker / Cache / Lock**| Redis (ioredis, Socket.IO Redis Adapter) | Real-time Pub/Sub clustering, distributed locks, rate limiting |
| **Payments** | Stripe (Node.js SDK, Test Mode) | PaymentIntent creation, payment verification, webhook signatures |
| **Orchestration** | Docker & Docker Compose | Containerized execution of Next.js, NestJS x2, Redis, MongoDB, Nginx |

## Architecture Diagram

```
                       ┌───────────────────────────────┐
                       │      Next.js Frontend         │
                       │   (Client / App Router)       │
                       └───────────────┬───────────────┘
                                       │ HTTP / WebSockets
                               ┌───────▼────────┐
                               │     Nginx      │
                               │ Load Balancer  │
                               └───────┬────────┘
                                  ┌────┴────┐
                       HTTP / WS  │         │  HTTP / WS
                    ┌─────────────▼──┐   ┌──▼─────────────┐
                    │ NestJS Node 1  │   │ NestJS Node 2  │
                    │   (Port 3001)  │   │   (Port 3002)  │
                    └──────┬───────┬─┘   └─┬───────┬──────┘
                           │       │       │       │
             MongoDB Driver│       │ Redis │       │ MongoDB Driver
                    ┌──────▼─┐   ┌─▼───────▼──┐   ┌▼───────┐
                    │        │   │   Redis    │   │        │
                    │MongoDB ◄───┤  Pub/Sub   ├───►MongoDB │
                    │        │   │  & Locks   │   │        │
                    └────────┘   └────────────┘   └────────┘
                                       ▲
                                       │ (Adapter sync)
                    ┌──────────────────┴──────────────────┐
                    │ Stripe Webhooks ──► NestJS Instances│
                    └─────────────────────────────────────┘
```

## System Boundaries

- `apps/backend/src/modules/auth`: User registration, bcrypt password hashing, JWT strategy, roles guards (`@Roles('customer', 'provider')`), and auth decorators.
- `apps/backend/src/modules/requests`: Customer request creation, query pagination, ownership verification, and status state machine (`OPEN`, `ACCEPTED`, `PAID`, `COMPLETED`, `CANCELLED`).
- `apps/backend/src/modules/offers`: Provider offer submission, pricing rules, offer queries, and atomic concurrency-guarded offer acceptance.
- `apps/backend/src/modules/payments`: Stripe SDK integration, backend-calculated PaymentIntents, webhook signature verification (`stripe.webhooks.constructEvent`), and idempotent webhook execution.
- `apps/backend/src/modules/chat`: Conversation room lifecycle, message persistence, message pagination, and authorization checks.
- `apps/backend/src/modules/socket`: Socket.IO gateway with Redis adapter, handshake JWT authentication, and event dispatchers (`request:created`, `offer:created`, `offer:accepted`, `message:new`).
- `apps/backend/src/modules/redis`: Redis connection management, distributed lock helper (`acquireLock` / `releaseLock`), and rate-limiter service.
- `apps/frontend/src/app`: Next.js App Router pages: `/auth/login`, `/auth/register`, `/customer/requests`, `/provider/browse`, `/requests/[id]`, `/chat/[id]`.
- `docker/`: `docker-compose.yml`, Dockerfiles for NestJS and Next.js, and `nginx.conf` for reverse proxy and WebSocket upgrade forwarding.

## Storage Model

### MongoDB Collections
1. **`users`**: `_id`, `email` (unique index), `passwordHash`, `role` (`'customer' | 'provider'`), `name`, `createdAt`.
2. **`service_requests`**: `_id`, `title`, `description`, `budget`, `status` (`'OPEN' | 'ACCEPTED' | 'PAID' | 'COMPLETED' | 'CANCELLED'`), `customerId` (ref User, indexed), `acceptedOfferId` (ref Offer, optional), `createdAt`.
3. **`offers`**: `_id`, `requestId` (ref ServiceRequest, compound index with `status`), `providerId` (ref User, indexed), `price`, `message`, `status` (`'PENDING' | 'ACCEPTED' | 'REJECTED'`), `createdAt`.
4. **`payments`**: `_id`, `requestId` (ref ServiceRequest), `offerId` (ref Offer), `customerId` (ref User), `providerId` (ref User), `amount`, `currency`, `status` (`'PENDING' | 'SUCCEEDED' | 'FAILED'`), `stripePaymentIntentId` (unique index), `createdAt`.
5. **`conversations`**: `_id`, `requestId` (unique ref), `customerId` (ref User), `providerId` (ref User), `createdAt`, `updatedAt`.
6. **`messages`**: `_id`, `conversationId` (ref Conversation, indexed with `createdAt`), `senderId` (ref User), `content`, `createdAt`.
7. **`processed_events`**: `_id` (Stripe `eventId` unique index), `eventType`, `processedAt`.

### Redis Data Structures
- **Pub/Sub Channels**: Managed by `@socket.io/redis-adapter` for inter-instance event synchronization.
- **Distributed Locks**: String keys with TTL `lock:request:<requestId>` using atomic `SET key value NX EX 10` and Lua-script release for safe mutual exclusion.
- **Rate Limiting**: Sliding window / token bucket keys `rate:auth:<ip>` and `rate:api:<userId>`.

## Auth and Access Model

1. **REST Authentication**: Clients transmit standard HTTP Bearer tokens (`Authorization: Bearer <JWT>`). NestJS `JwtAuthGuard` extracts and validates the payload (`sub`, `role`, `email`).
2. **Socket.IO Authentication**: Clients pass the JWT in `io(url, { auth: { token } })`. The NestJS Gateway intercepts `handleConnection`, decodes the JWT, rejects invalid handshakes with connection errors, and attaches `socket.data.user`.
3. **Role-Based Access Control (RBAC)**: Custom `@Roles('customer')` and `@Roles('provider')` decorators backed by `RolesGuard` block unauthorized role execution.
4. **Room Authorization**: Before a socket joins a conversation room (`conversation:<id>`), the gateway verifies that `socket.data.user.id` matches either the conversation's `customerId` or `providerId`. Arbitrary room joining is blocked.

## Core Architectural Invariants

1. **Single Acceptance Invariant (Concurrency Safety)**: A service request can have many offers, but strictly ONE offer can be accepted. Acceptance MUST acquire the Redis distributed lock `lock:request:<requestId>` AND execute a conditional atomic update `findOneAndUpdate({ _id: requestId, status: 'OPEN' }, { $set: { status: 'ACCEPTED', acceptedOfferId: offerId } })`. If either fails, the transaction is rejected with HTTP `409 Conflict`.
2. **Webhook Idempotency Invariant**: Every Stripe webhook event ID is recorded in `processed_events`. If a webhook arrives with an existing ID, the system acknowledges receipt (`200 OK`) immediately without re-executing business logic or creating duplicate transactions.
3. **Server-Determined Payment Amounts**: The frontend NEVER supplies the monetary amount for a Stripe PaymentIntent. The backend fetches the accepted offer price from MongoDB and passes that verified amount to the Stripe API.
4. **Stateless Horizontal Scale**: All NestJS backend instances are completely stateless. Sessions, distributed locks, and Socket.IO events are delegated to Redis and MongoDB, allowing arbitrary instances to be added behind the load balancer.
5. **Room Privacy Invariant**: Real-time events and chat messages are delivered exclusively to authorized rooms and user IDs; no broadcast leaks sensitive pricing or messaging data to unrelated users.
