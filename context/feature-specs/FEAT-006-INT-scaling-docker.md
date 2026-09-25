# FEAT-006-INT — Multi-Instance Horizontal Scaling & Docker Topology (P0)

**Layer**: Integration  
**Goal**: Configure and orchestrate 2 NestJS instances, Next.js, Redis, MongoDB, and Nginx in Docker Compose, proving cross-instance real-time synchronization.

## Depends on
`FEAT-001` through `FEAT-005`, `000-infra-contracts.md`

## Context pack
```typescript
// Infrastructure Nodes
Node 1: http://localhost:3001
Node 2: http://localhost:3002
Nginx Load Balancer: http://localhost:8080
Redis Pub/Sub Broker: redis://localhost:6379
MongoDB Replica/Database: mongodb://localhost:27017/marketplace
```

## Consumes
All implemented modules from `FEAT-001` through `FEAT-005`.

## Provides / Exposes
```yaml
# Docker Compose Services
- mongo (27017)
- redis (6379)
- backend-1 (3001)
- backend-2 (3002)
- nginx (8080)
- frontend (3000)
```

## Scope (In)
- Dockerfiles for NestJS backend (`apps/backend/Dockerfile`) and Next.js frontend (`apps/frontend/Dockerfile`).
- Root `docker-compose.yml` linking all 6 services with proper healthchecks and dependency startup order.
- Nginx configuration (`docker/nginx.conf`) forwarding HTTP `/api` and WebSocket `/socket.io` to upstream pool (`backend-1:3001`, `backend-2:3002`).
- Demonstration script/test proving Client A connected to Node 1 receives real-time events emitted by Client B connected to Node 2.

## Scope (Out)
- Kubernetes orchestration or cloud infrastructure as code (`Out of assessment scope`).

## Tech / files to touch
- `docker-compose.yml`
- `docker/nginx.conf`
- `apps/backend/Dockerfile`
- `apps/frontend/Dockerfile`
- `scripts/verify-cluster.ts`

## Nonfunctional requirements
- Turnkey startup: running `docker compose up` brings up the full working platform with zero manual steps.
- Clean shutdown: SIGTERM signals gracefully disconnect Redis and MongoDB.
- Load balancing: Nginx distributes connections across both NestJS nodes.

## Tests to write FIRST
1. `should connect socket client A directly to port 3001 and socket client B directly to port 3002`
2. `should broadcast event from client A on Node 1 and receive it on client B on Node 2 via Redis adapter`
3. `should route requests through Nginx load balancer to both backend instances`
4. `should handle simultaneous requests across both instances without data corruption`

## Implementation steps
1. Write multi-stage Dockerfile for NestJS backend.
2. Write multi-stage Dockerfile for Next.js frontend.
3. Configure `docker/nginx.conf` with `upstream nestjs_cluster { ip_hash; server backend-1:3001; server backend-2:3002; }` and WebSocket upgrade headers.
4. Construct `docker-compose.yml` specifying environment variables and networking.
5. Create automated cluster verification script `scripts/verify-cluster.ts`.

## Acceptance criteria
- [ ] `docker compose up` boots all 6 containers with green health status.
- [ ] Direct connection to Node 1 and Node 2 confirms Redis Pub/Sub adapter synchronization.
- [ ] Nginx proxy correctly routes REST API requests and upgrades WebSockets.

## Definition of Done
- [ ] Cluster integration tests pass 100%.
- [ ] Test report generated in `feature-test-reports/FEAT-006-test-report.md`.

## Edge cases to handle
- Race condition on container startup: backend containers wait for Redis and MongoDB ports to open before starting.

## Pre-flight check
Confirm `FEAT-001` through `FEAT-005` have passed verification.

## What's next
- `FEAT-006-VERIFY-scaling.md` and `epics/EPIC-001-VERIFY-marketplace-lifecycle.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
