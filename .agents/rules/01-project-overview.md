# Rule: Project Overview & Scope

Every prompt execution and implementation task must strictly adhere to the Real-Time Service Marketplace specifications:

- **Core Goal**: Full-stack marketplace with Customers creating requests and Providers submitting competing offers in real time.
- **Tech Stack**: Next.js, NestJS (2 instances), MongoDB (Mongoose), Socket.IO with Redis Adapter, Redis (distributed locks, pub/sub, rate limiting), Stripe (test mode, webhooks), Docker Compose.
- **Roles**: Customer and Provider.
- **Mandatory Requirements**:
  1. Authenticated Socket.IO connections with Redis adapter for horizontal scaling.
  2. Concurrency challenge: Distributed lock + atomic DB update to prevent double-acceptance race conditions.
  3. Stripe test mode payments with server-side amount calculation and idempotent webhook verification.
  4. Role-based REST and WebSocket room authorization for chat.
  5. Multi-instance Docker Compose setup.
- Source of truth: `context/project-overview.md` and `context/feature-specs/Project-scope.md`.
