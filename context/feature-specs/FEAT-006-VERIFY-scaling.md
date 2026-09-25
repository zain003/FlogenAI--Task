# FEAT-006-VERIFY — Horizontal Scaling & Docker Verification Pass

**Layer**: Verification  
**Files being verified**: `FEAT-006-INT-scaling-docker.md`, `000-infra-contracts.md`

## 1. Test Execution Verification

Execute cluster scaling test suites:
- [x] Run Cluster Verification Script: `npx ts-node scripts/verify-cluster.ts`
  - `should connect socket client A directly to port 3001 and socket client B directly to port 3002`
  - `should broadcast event from client A on Node 1 and receive it on client B on Node 2 via Redis adapter`
  - `should route requests through Nginx load balancer to both backend instances`
  - `should handle simultaneous requests across both instances without data corruption`
- [x] Run Docker Health Audit: `docker compose ps`
  - All 6 containers (`mongo`, `redis`, `backend-1`, `backend-2`, `nginx`, `frontend`) report `Up` / healthy.

## 2. Acceptance Criteria Verification Matrix

- [x] AC-1: Next.js 16, 2 NestJS instances, Redis, MongoDB, and Nginx launch with single command `docker compose up`.
- [x] AC-2: Socket.IO client connected to Instance 1 receives messages published from Instance 2.
- [x] AC-3: Nginx reverse proxy routes traffic reliably without 502 Bad Gateway errors.
- [x] AC-4: Concurrent requests load balanced across instances maintain database consistency.

## 3. Scalability Audit

- [x] Stateless verification: Backend instances can be stopped and restarted without session disruption.
- [x] Redis adapter channels confirm subscription to Socket.IO events.

## 4. SQA Test Report Generation Mandate

- [x] Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/FEAT-006-test-report.md`.
- [x] Record cluster execution results, latency timings, and verdict: `APPROVED (PASSED 100%)`.
- [x] Update `context/feature-specs/INDEX.md` and `context/progress-tracker.md`.

## Stop-The-Line Rule
If cross-instance communication fails or if any container fails to boot: do NOT mark complete. Resolve cluster networking and re-verify.
