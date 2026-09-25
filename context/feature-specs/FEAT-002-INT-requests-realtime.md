# FEAT-002-INT — Real-Time Request Broadcast via Redis Adapter (P0)

**Layer**: Integration  
**Goal**: Broadcast `request:created` event across Socket.IO and the Redis Adapter to all connected Providers when a Customer creates a request.

## Depends on
`FEAT-002-BE-requests.md`, `000-shared-contracts.md`

## Context pack
```typescript
export interface ServiceRequestEntity {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: RequestStatus;
  customerId: string;
  createdAt: string;
}

export interface ServerToClientEvents {
  'request:created': (payload: { request: ServiceRequestEntity }) => void;
}
```

## Consumes
```typescript
POST /api/requests (body: CreateRequestDto, auth: Customer) => Promise<ServiceRequestEntity>
```

## Provides / Exposes
```typescript
// Socket.IO Room & Event
Room: "providers"
Event: "request:created" => { request: ServiceRequestEntity }

export class MarketplaceGateway {
  emitRequestCreated(request: ServiceRequestEntity): void;
}
```

## Scope (In)
- Socket.IO Redis Pub/Sub adapter setup in NestJS (`@socket.io/redis-adapter`).
- Socket connection authentication verifying JWT during handshake.
- Auto-joining connected providers to room `"providers"`.
- Dispatching `request:created` to room `"providers"` upon request creation.
- Frontend SocketContext listening for `request:created` and appending new request to feed.

## Scope (Out)
- Real-time offer submissions (`FEAT-003-INT`).
- Chat message dispatching (`FEAT-005-INT`).

## Tech / files to touch
- `apps/backend/src/modules/socket/socket.gateway.ts`
- `apps/backend/src/modules/socket/socket-redis.adapter.ts`
- `apps/frontend/src/context/socket-context.tsx`
- `apps/frontend/src/app/provider/browse/page.tsx`

## Event delivery & failure contract
- **Delivery Guarantee**: At-least-once across connected WebSocket instances via Redis Pub/Sub.
- **Idempotency Mechanism**: Frontend deduplicates incoming requests in local state by `request.id`.
- **Failure Behavior**: If Redis is momentarily unavailable, fallback to local instance broadcast and log warning.

## Tests to write FIRST
1. `should reject socket connection when handshake token is invalid or missing`
2. `should authenticate provider socket and auto-join providers room`
3. `should broadcast request:created event to providers room when request is created`
4. `should propagate request:created across two backend instances via Redis pub/sub`
5. `should update provider UI feed when request:created event is received`

## Implementation steps
1. Configure `RedisIoAdapter` extending `IoAdapter` using Redis pub/sub clients.
2. In `MarketplaceGateway`, intercept `handleConnection`, verify JWT token, and join providers to `"providers"` room.
3. In `RequestsService.create`, inject `MarketplaceGateway` and call `emitRequestCreated`.
4. In frontend `SocketContext`, connect to WebSocket with stored JWT.
5. In Provider Browse page, listen to `request:created` and prepend new request to list with visual flash.

## Acceptance criteria
- [ ] Connected provider receives `request:created` event within 200ms of customer creation.
- [ ] Provider connected to NestJS Instance 1 receives event when customer posts to NestJS Instance 2.
- [ ] Customer sockets do NOT receive the broadcast in `"providers"` room.

## Definition of Done
- [ ] Integration tests pass for multi-instance Redis broadcast.
- [ ] Clean typecheck and linting.
- [ ] Test report generated using `feature-test-reports/template-test-report.md`.

## Edge cases to handle
- Socket disconnect and reconnect: client fetches latest feed on reconnect to catch missed items.

## Pre-flight check
Confirm `FEAT-002-BE-requests.md` is verified.

## What's next
- `FEAT-002-VERIFY-requests.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
