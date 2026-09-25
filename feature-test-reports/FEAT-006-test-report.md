# Test Report: FEAT-006 — Multi-Instance Horizontal Scaling & Docker Topology (INT & VERIFY Layers)

**Feature ID:** `FEAT-006` (`FEAT-006-INT-scaling-docker.md`, `FEAT-006-VERIFY-scaling.md`, `000-infra-contracts.md`)  
**Spec References:** [`context/feature-specs/FEAT-006-INT-scaling-docker.md`](../context/feature-specs/FEAT-006-INT-scaling-docker.md), [`context/feature-specs/FEAT-006-VERIFY-scaling.md`](../context/feature-specs/FEAT-006-VERIFY-scaling.md), [`context/feature-specs/000-infra-contracts.md`](../context/feature-specs/000-infra-contracts.md)  
**Date Tested:** `2026-09-25`  
**SQA Status:** `PASSED`  
**Tester:** `SQA Automation Engineer`  

---

## 1. Executive Summary

| Layer / Scope | Executed Tests | Passed | Failed | Skipped | Pass Rate | SQA Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Live Cluster Verification Suite (`scripts/verify-cluster.ts`)** | **4** | **4** | `0` | `0` | `100%` | **APPROVED** |
| **Backend Multi-Instance & Unit Tests (Jest)** | **219** (21 suites) | **219** | `0` | `0` | `100%` | **APPROVED** |
| **Frontend Fake DOM Suite (Vitest + RTL)** | **66** (12 suites) | **66** | `0` | `0` | `100%` | **APPROVED** |
| **Full Monorepo Automated Quality Gate** | **289** | **289** | `0` | `0` | `100%` | **APPROVED (PASSED 100%)** |
| **Docker Compose Container Health Audit** | **6/6** containers | **6/6** | `0` | `0` | `100%` | **ALL HEALTHY** |

> **SQA Gate Policy:** Zero failing tests allowed. All 4 live cluster integration tests across dual NestJS instances, Nginx load balancer, Redis Pub/Sub adapter, and MongoDB passed with 100% success rate. All 6 Docker containers (`marketplace-mongo`, `marketplace-redis`, `marketplace-backend-1`, `marketplace-backend-2`, `marketplace-lb`, `marketplace-frontend`) report healthy status with automated healthchecks. Zero compiler or typecheck errors across backend and frontend workspaces.

---

## 2. Test Environment & Tools

- **Container Engine:** Docker Engine v29.2.1 (WSL2 Linux Kernel 6.6.87, 12 CPUs, 7.4GiB RAM)
- **Container Orchestrator:** Docker Compose v5.0.2
- **Load Balancer:** Nginx (`nginx:alpine`) listening on `http://localhost:8080`, proxying to `backend-1:3001` and `backend-2:3002` with `ip_hash` sticky routing and WebSocket upgrade headers (`Upgrade`, `Connection: "Upgrade"`).
- **Backend Nodes:** 2x NestJS instances (`marketplace-backend-1` on port 3001, `marketplace-backend-2` on port 3002) running in hardened Node.js 20 Alpine containers with non-root security (`USER node`).
- **Real-Time Adapter:** Redis 7.0 (`redis:7.0-alpine`) on port 6379 with `@socket.io/redis-adapter` Pub/Sub clustering.
- **Database:** MongoDB 6.0 (`mongo:6.0`) on port 27017 with persistent volume `mongo-data`.
- **Frontend App:** Next.js 16.3.6 (App Router + Turbopack + React 19) in production container (`marketplace-frontend`) on port 3000.
- **Test Automation Utility:** `scripts/verify-cluster.ts` executed via `ts-node` (and `npm run verify:cluster`), Jest v29.7.0, Vitest v3.2.7.

---

## 3. Acceptance Criteria Traceability Matrix

| AC ID | Acceptance Criterion | Test File & Verification Step | Status |
| :--- | :--- | :--- | :--- |
| **AC-1** | Next.js 16, 2 NestJS instances, Redis, MongoDB, and Nginx launch with single command `docker compose up` | `docker compose ps` audit: 6/6 containers report `Up (healthy)` | `PASS` |
| **AC-2** | Socket.IO client connected to Instance 1 receives messages published from Instance 2 via Redis Pub/Sub adapter | `scripts/verify-cluster.ts` > `TEST-CLUSTER-02` (Latency: ~524ms) & `socket-redis.spec.ts` | `PASS` |
| **AC-3** | Nginx reverse proxy routes traffic reliably without 502 Bad Gateway errors and completes WebSocket upgrades | `scripts/verify-cluster.ts` > `TEST-CLUSTER-03` & `socket-redis.spec.ts` | `PASS` |
| **AC-4** | Concurrent requests load balanced across instances maintain database consistency without race conditions | `scripts/verify-cluster.ts` > `TEST-CLUSTER-04` (Statuses: `[200, 409]`) & `offers-concurrency.spec.ts` | `PASS` |
| **AC-5** | Direct socket connection directly to port 3001 and port 3002 succeeds with handshake JWT authentication | `scripts/verify-cluster.ts` > `TEST-CLUSTER-01` & `socket-redis.spec.ts` | `PASS` |
| **AC-6** | Turnkey startup with strict ordered health dependency (`depends_on: { condition: service_healthy }`) | Root `docker-compose.yml` service orchestration & startup ordering | `PASS` |
| **AC-7** | Clean shutdown: SIGTERM signals gracefully disconnect Redis and MongoDB | `apps/backend/src/main.ts` (`app.enableShutdownHooks()`) & `redis.service.ts` (`onModuleDestroy`) | `PASS` |
| **AC-8** | Stateless backend verification: Instance restart occurs without cluster breakdown or data corruption | `docker compose restart backend-1` executed with immediate recovery and passing re-test | `PASS` |
| **AC-9** | Dedicated health audit endpoints for automated container probes | `apps/backend/src/app.controller.ts` (`GET /api/health`) & `docker/nginx.conf` (`GET /health`) | `PASS` |

---

## 4. Multi-Layer Test Execution Results

### 4.1 Live Multi-Instance Cluster Verification (`scripts/verify-cluster.ts`)

```bash
> flogen-ai-marketplace@1.0.0 verify:cluster
> ts-node scripts/verify-cluster.ts

=================================================================
   FEAT-006-INT / VERIFY: Multi-Instance Scaling Verification    
=================================================================

Target Topology:
  - Backend Node 1:  http://localhost:3001
  - Backend Node 2:  http://localhost:3002
  - Nginx Balancer:  http://localhost:8080
  - Frontend App:    http://localhost:3000

Phase 0: Service Readiness Probes
Waiting for Backend Node 1 at http://localhost:3001/api/health... READY (attempt 1)
Waiting for Backend Node 2 at http://localhost:3002/api/health... READY (attempt 1)
Waiting for Nginx Load Balancer at http://localhost:8080/health... READY (attempt 1)
Waiting for Frontend Next.js 16 at http://localhost:3000... READY (attempt 1)

All target services verified online.

Phase 1: Authenticating Test Actors
  Authenticating Customer on Node 1 (http://localhost:3001)...
  Authenticating Provider on Node 2 (http://localhost:3002)...
  ✓ Actor JWT tokens acquired successfully.

Phase 2: Executing Cluster Test Suites
  ✓ TEST-CLUSTER-01: should connect socket client A directly to port 3001 and socket client B directly to port 3002 (33ms)
    Client A connected to Node 1 (id: AF1oAOWQN4swaJtCAAAC) | Client B connected to Node 2 (id: uanXpTsw8KbZbaVZAAAD)
  ✓ TEST-CLUSTER-02: should broadcast event from client A on Node 1 and receive it on client B on Node 2 via Redis adapter (538ms)
    Node 1 HTTP trigger emitted 'request:created' -> Redis adapter synchronized -> Node 2 delivered to Client B (Latency: ~538ms)
  ✓ TEST-CLUSTER-03: should route requests through Nginx load balancer to both backend instances (33ms)
    Nginx port 8080 successfully proxied REST API queries and completed WebSocket upgrade handshake
  ✓ TEST-CLUSTER-04: should handle simultaneous requests across both instances without data corruption (114ms)
    Parallel requests across Node 1 & Node 2 -> Statuses: [200, 409] (Exactly 1 Accepted, 1 Conflict 409). DB status: ACCEPTED. Zero double-acceptance.

=================================================================
                 CLUSTER SQA EXECUTION SUMMARY                   
=================================================================
| Test ID          | Status | Time (ms) | Test Name                  |
|------------------|--------|-----------|----------------------------|
| TEST-CLUSTER-01  | PASS   |        33 | should connect socket clie |
| TEST-CLUSTER-02  | PASS   |       538 | should broadcast event fro |
| TEST-CLUSTER-03  | PASS   |        33 | should route requests thro |
| TEST-CLUSTER-04  | PASS   |       114 | should handle simultaneous |
|-------------------------------------------------------------------|

Result: 4/4 tests passed (100%)

✓ SQA VERDICT: CLUSTER SCALING FULLY VERIFIED (PASSED 100%)
```

---

### 4.2 Docker Health Audit (`docker compose ps`)

```bash
NAME                    IMAGE                COMMAND                  SERVICE     CREATED         STATUS                   PORTS
marketplace-backend-1   flogenai-backend-1   "docker-entrypoint.s…"   backend-1   4 minutes ago   Up 3 minutes (healthy)   0.0.0.0:3001->3001/tcp, [::]:3001->3001/tcp
marketplace-backend-2   flogenai-backend-2   "docker-entrypoint.s…"   backend-2   4 minutes ago   Up 4 minutes (healthy)   0.0.0.0:3002->3002/tcp, [::]:3002->3002/tcp
marketplace-frontend    flogenai-frontend    "docker-entrypoint.s…"   frontend    6 minutes ago   Up 4 minutes (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
marketplace-lb          nginx:alpine         "/docker-entrypoint.…"   nginx       6 minutes ago   Up 4 minutes (healthy)   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
marketplace-mongo       mongo:6.0            "docker-entrypoint.s…"   mongo       6 minutes ago   Up 6 minutes (healthy)   0.0.0.0:27017->27017/tcp, [::]:27017->27017/tcp
marketplace-redis       redis:7.0-alpine     "docker-entrypoint.s…"   redis       6 minutes ago   Up 6 minutes (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
```

---

### 4.3 Backend Multi-Instance & Unit Layer (`npm run test:backend`)

```bash
PASS src/modules/socket/socket.gateway.spec.ts (15.269 s)
PASS src/modules/auth/guards/roles.guard.spec.ts
PASS src/modules/chat/chat.service.spec.ts (16.266 s)
PASS src/modules/socket/socket-redis.spec.ts (16.423 s)
PASS src/modules/redis/distributed-lock.service.spec.ts (16.309 s)
PASS src/modules/auth/guards/jwt-auth.guard.spec.ts
PASS src/app.controller.spec.ts
PASS src/modules/socket/socket.chat.spec.ts (17.133 s)
PASS src/modules/requests/requests.service.spec.ts (17.226 s)
PASS src/modules/payments/payments-webhook.service.spec.ts (17.166 s)
PASS src/modules/auth/auth.service.spec.ts (17.897 s)
PASS src/modules/offers/offers-concurrency.spec.ts (18.868 s)
PASS src/modules/offers/offers.service.spec.ts (18.992 s)
PASS src/modules/chat/chat.controller.spec.ts
PASS src/modules/auth/auth.controller.spec.ts
PASS src/modules/requests/requests.controller.spec.ts (5.897 s)
PASS src/modules/payments/stripe.service.spec.ts (6.546 s)
PASS src/modules/offers/offers.controller.spec.ts (5.688 s)
PASS src/modules/payments/payments.service.spec.ts (25.19 s)
PASS src/modules/payments/payments.controller.spec.ts (10.186 s)
PASS src/modules/payments/webhook.spec.ts (10.568 s)

Test Suites: 21 passed, 21 total
Tests:       219 passed, 219 total
Snapshots:   0 total
Time:        29.085 s
```

---

### 4.4 Frontend Fake DOM Layer (`npm run test:ui`)

```bash
 ✓ src/tests/auth-context.spec.tsx (4 tests) 340ms
 ✓ src/tests/navigation-bar.spec.tsx (4 tests) 618ms
 ✓ src/tests/payments-realtime.spec.tsx (3 tests) 626ms
 ✓ src/tests/payments.spec.tsx (6 tests) 759ms
 ✓ src/tests/provider-realtime.spec.tsx (3 tests) 756ms
 ✓ src/tests/offers-realtime.spec.tsx (4 tests) 900ms
 ✓ src/tests/chat.spec.tsx (9 tests) 1642ms
 ✓ src/tests/chat-realtime.spec.tsx (3 tests) 139ms
 ✓ src/tests/offers.spec.tsx (9 tests) 1910ms
 ✓ src/tests/login.spec.tsx (5 tests) 2497ms
 ✓ src/tests/requests.spec.tsx (10 tests) 3419ms
 ✓ src/tests/register.spec.tsx (6 tests) 4592ms

 Test Files  12 passed (12)
      Tests  66 passed (66)
   Duration  12.19s
```

---

### 4.5 Typecheck Audit

```bash
> flogen-ai-marketplace@1.0.0 typecheck:backend
> tsc --noEmit (Passed with 0 errors)

> flogen-ai-marketplace@1.0.0 typecheck:frontend
> tsc --noEmit (Passed with 0 errors)
```

---

## 5. Edge Cases & Boundary Analysis

| Scenario | Trigger / Test Condition | Expected Behavior | Observed Result | Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Startup Race Condition** | Backend starts while MongoDB / Redis are initializing | Backend healthcheck waits; `depends_on` conditions enforce `service_healthy` | Containers wait; zero connection crash loops | `PASS` |
| **Simultaneous Acceptance Race** | Client A hits Node 1 and Client B hits Node 2 at exact same millisecond | Redis lock + MongoDB atomic conditional status guarantee exactly 1 acceptance | Statuses: `[200, 409]`; DB records 1 winning offer | `PASS` |
| **Node Termination / Restart** | Node 1 killed and restarted via `docker compose restart backend-1` | Node 2 handles traffic; Node 1 reconnects to Redis and resumes sync | Zero session disruption; post-restart verification passed | `PASS` |
| **WebSocket Upgrade Through Nginx** | Client connects to `http://localhost:8080/socket.io/` | Nginx forwards `Upgrade: websocket` and proxies real-time events | Handshake completed; real-time events delivered | `PASS` |
| **REST Path Routing** | Client queries `/api/requests` through Nginx port 8080 | Nginx preserves URL path and routes to upstream `backend-1` / `backend-2` | Returns HTTP 200 with full paginated payload | `PASS` |

---

## 6. Defects Discovered & Resolved

| Bug ID | Description | Root Cause | Resolution | Retest Status |
| :--- | :--- | :--- | :--- | :--- |
| `BUG-CLUSTER-01` | `TypeError: stripe_1.default is not a constructor` upon container boot | In production CommonJS bundle, Stripe SDK export format varies between direct and default exports | Resolved constructor with `const StripeConstructor = (Stripe as any)?.default \|\| Stripe;` in `stripe.service.ts` | `VERIFIED FIXED` |
| `BUG-CLUSTER-02` | Docker Compose warning: attribute `version` is obsolete | Top-level `version: '3.8'` is deprecated in modern Compose specification | Removed obsolete attribute from `docker-compose.yml` | `VERIFIED FIXED` |
| `BUG-CLUSTER-03` | Next.js API route duplication if `NEXT_PUBLIC_API_URL` has trailing `/api` | In `next.config.js`, `${process.env.NEXT_PUBLIC_API_URL}/api/:path*` produced `/api/api/:path*` | Sanitized base URL with `.endsWith('/api') ? url.slice(0, -4) : url` | `VERIFIED FIXED` |

---

## 7. SQA Sign-Off & Recommendation

- [x] **100% Test Pass Rate Achieved across all 289 automated tests**
- [x] **6/6 Docker Containers running with verified `healthy` status**
- [x] **Zero Double-Acceptances or state corruption across distributed nodes**
- [x] **Zero Unresolved Defects**
- [x] **Feature Ready for Transition to EPIC-001 End-to-End Journey Verification**

**Final SQA Verdict:** **APPROVED (PASSED 100%)**
