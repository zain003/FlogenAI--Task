# Rule: Architecture Context & System Invariants

Every prompt execution and implementation task must maintain the architectural boundaries and invariants:

- **System Diagram**: Next.js -> Nginx Load Balancer -> NestJS Instance 1 (Port 3001) & NestJS Instance 2 (Port 3002) -> MongoDB. NestJS instances communicate via Redis Pub/Sub and acquire distributed locks from Redis.
- **Invariants**:
  1. **Single Acceptance Invariant**: Only ONE offer may be accepted per service request. Must use Redis distributed lock `lock:request:<requestId>` AND MongoDB conditional atomic check (`status: 'OPEN'`).
  2. **Webhook Idempotency Invariant**: Webhook events must check `processed_events` before executing. Replay requests must return 200 OK without duplicating state changes.
  3. **Price Integrity**: Payment amounts are strictly determined on the backend by querying the accepted offer price in MongoDB.
  4. **Room Privacy**: Chat rooms (`conversation:<id>`) require server-side validation that the user is the customer or provider of that conversation.
  5. **Stateless Scale**: Backend nodes must remain stateless.
- Source of truth: `context/architecture.md`.
