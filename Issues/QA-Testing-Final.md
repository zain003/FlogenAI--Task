# Real-Time Service Marketplace (FlogenAI) — QA Audit & Testing Plan (v4)

> **Document Status:** Authoritative Master SQA Audit Specification & Execution Protocol  
> **Source Baseline:** `context/project-overview.md`, `context/feature-specs/Project-scope.md`, `context/architecture.md`, `context/code-standards.md`, `context/testing-strategy.md`, `context/ui-context.md`, `000-shared-contracts.md`, `000-nonfunctional-contracts.md`, `000-infra-contracts.md`, and all Feature Specs (`FEAT-001` through `FEAT-006`, and `EPIC-001`).

---

## 1. Project Context & Technical Assessment Scope

This document defines the comprehensive Quality Assurance (QA) audit framework, test matrices, and execution protocol for the Real-Time Service Marketplace (FlogenAI).

### 1.1 Core Engineering Assessment Objectives (`Project-scope.md`)
Per `Project-scope.md`, the platform is evaluated on scalable systems engineering, real-time distributed architecture, concurrency safety, payments integrity, and zero-trust security:
1. **Authentication & RBAC (`Section 1`):** Customer & Provider registration/login, JWT authentication, bcrypt hashing (rounds >= 10), role-based REST guards, authenticated WebSocket handshakes.
2. **Customer Flow (`Section 2`):** Create requests (`title`, `description`, `budget >= $1.00`), view private requests, receive real-time bids, accept strictly ONE offer, execute server-priced Stripe payment, chat with accepted provider.
3. **Provider Flow (`Section 3`):** Browse open requests feed, submit competitive bids (`price >= $1.00`, `message`), receive real-time request/offer updates, notified upon acceptance, chat with customer post-acceptance.
4. **Socket.IO Real-Time Architecture (`Section 4`):**
   - `request:created` broadcast to connected providers.
   - `offer:created` emitted immediately to the customer's private room.
   - `offer:accepted` emitted immediately to the selected provider; `request:closed` broadcast to other providers.
   - Customer ↔ Provider chat with MongoDB persistence (`conversation:join`, `message:send`, `message:new`).
   - Zero-trust server-side room authorization blocking arbitrary room joins.
5. **Redis Integration (`Section 5`):**
   - Socket.IO Redis Pub/Sub adapter synchronizing WebSocket events across multiple NestJS backend instances.
   - Meaningful Redis use case: Distributed mutual exclusion locks (`mkt:lock:request:<id>`) with atomic Lua token verification and IP rate limiting (`rate:auth:<ip>`).
6. **Horizontal Scaling Demonstration (`Section 6`):**
   - Minimum 2 NestJS backend instances (Node 1 on port 3001, Node 2 on port 3002).
   - Cross-instance Socket.IO communication verified across nodes.
   - Reverse proxy / load balancer (Nginx on port 8080) with sticky `ip_hash` and WebSocket upgrade headers.
7. **Concurrency Challenge (`Section 7`):**
   - Prevent double-acceptance race conditions when two parallel acceptance requests hit different backend nodes simultaneously.
   - Two-tier concurrency guard: Tier 1 Redis distributed lock + Tier 2 MongoDB atomic conditional mutation (`findOneAndUpdate({ _id: requestId, status: 'OPEN' })`).
8. **MongoDB Persistence & Schema Design (`Section 8`):**
   - Models: `User`, `ServiceRequest`, `Offer`, `Conversation`, `Message`, `Payment`, `ProcessedEvent`.
   - References, field validations, compound indexes (`service_requests: status, customerId`, `offers: requestId, status`, `messages: conversationId, createdAt`).
   - Enforced pagination (default 20, max 50) on all collection list endpoints (unbounded queries strictly prohibited).
9. **Stripe Payments & Webhooks (`Section 9`):**
   - Stripe Test Mode integration with server-calculated amounts (`amount = Math.round(offer.price * 100)`).
   - Raw-body cryptographic HMAC-SHA256 signature verification (`stripe.webhooks.constructEvent`).
   - Strict webhook idempotency via `processed_events` table (duplicate delivery returns HTTP 200 with zero duplicate database mutations).
   - Zero storage of raw cardholder numbers or CVV.
10. **REST APIs & Architecture (`Section 10`):**
    - Clean NestJS modular architecture (`auth`, `requests`, `offers`, `payments`, `chat`, `socket`, `redis`).
    - ValidationPipe (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
11. **Docker Topology (`Section 11`):**
    - Turnkey multi-container orchestration (`docker compose up`) linking Next.js 16, NestJS Node 1, NestJS Node 2, MongoDB 6.0, Redis 7.0-alpine, and Nginx.
12. **Zero-Trust Security (`Section 12`):**
    - Never trust client inputs (user ID, role, price, ownership).
13. **Minimalist Next.js 16 Frontend (`Section 13`):**
    - Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS), high-contrast dark theme, accessible controls.

---

## 2. User Roles & Permission Boundaries

| Role | Permitted Actions | Prohibited Actions / Boundary Checks |
| :--- | :--- | :--- |
| **`customer`** | • Register / Login (`POST /api/auth/*`)<br>• Create service request (`POST /api/requests`)<br>• View own requests (`GET /api/requests/my-requests`)<br>• View request details & offers (`GET /api/requests/:id`)<br>• Accept offer on owned request (`POST /api/offers/:id/accept`)<br>• Create Stripe PaymentIntent (`POST /api/payments/create-intent`)<br>• Chat with accepted provider (`/chat/[requestId]`) | • Cannot submit offers (`POST /api/requests/:id/offers` -> HTTP 403 Forbidden)<br>• Cannot accept offers on other customers' requests (HTTP 403)<br>• Cannot accept offers on closed requests (HTTP 409/400)<br>• Cannot tamper with payment amount (backend calculates amount)<br>• Cannot join arbitrary chat rooms (server checks ownership) |
| **`provider`** | • Register / Login (`POST /api/auth/*`)<br>• Browse open requests feed (`GET /api/requests?status=OPEN`)<br>• Submit offer on OPEN request (`POST /api/requests/:id/offers`)<br>• Receive real-time `request:created` & `offer:accepted`<br>• Chat with customer post-acceptance (`/chat/[requestId]`) | • Cannot create service requests (`POST /api/requests` -> HTTP 403 Forbidden)<br>• Cannot accept offers (`POST /api/offers/:id/accept` -> HTTP 403 Forbidden)<br>• Cannot submit offer on own request (HTTP 400)<br>• Cannot submit offer on closed request (HTTP 400)<br>• Cannot access customer private requests (HTTP 403)<br>• Cannot join chat rooms of losing offers (error callback) |
| **`guest` (Unauthenticated)** | • View landing page and public requests feed (`GET /api/requests`)<br>• View request details (`GET /api/requests/:id`) | • All mutations, offer acceptance, checkout, and chat blocked (HTTP 401 Unauthorized / redirect to `/login`)<br>• Socket connection without JWT handshake rejected |

---

## 3. Test Environments & Automated Test Commands

### Multi-Instance Infrastructure Topology
- **Next.js 16 Frontend:** `http://localhost:3000`
- **Nginx Reverse Proxy / Load Balancer:** `http://localhost:8080`
  - REST API gateway: `http://localhost:8080/api/*`
  - Socket.IO gateway: `ws://localhost:8080/socket.io/*`
- **NestJS Backend Node 1:** `http://localhost:3001`
- **NestJS Backend Node 2:** `http://localhost:3002`
- **MongoDB Database:** `mongodb://localhost:27017/marketplace`
- **Redis Cache & Pub/Sub:** `redis://localhost:6379`

### Test Suites Execution Commands
```bash
# 1. Backend Multi-Layer Test Suite (Jest: 21 suites, 222+ tests)
npm run test:backend

# 2. Frontend Fake DOM Component Test Suite (Vitest + React Testing Library: 14 suites, 77+ tests)
npm run test:ui

# 3. Full Marketplace End-to-End Lifecycle Suite (Jest E2E Runner: 7 journey steps)
npm run test:e2e

# 4. TypeScript Static Typecheck Verification
npm run typecheck:backend
npm run typecheck:frontend

# 5. Multi-Instance Cluster Synchronization Verification (Docker/Cluster runner)
npm run verify:cluster
```

---

## 4. Test Data, Credentials & Seed State

- **Standard Test Accounts:**
  - `customer`: `customer@test.com` / `Password123!` (Dynamic test fixture: `qa-cust-${Date.now()}@test.com`)
  - `provider 1`: `provider1@test.com` / `Password123!` (Dynamic test fixture: `qa-prov1-${Date.now()}@test.com`)
  - `provider 2`: `provider2@test.com` / `Password123!` (Dynamic test fixture: `qa-prov2-${Date.now()}@test.com`)
  - `guest`: Unauthenticated visitor
- **Token Storage Key:** `auth_token` in browser `localStorage`.
- **Stripe Sandbox Credentials:**
  - Card Number: `4242 4242 4242 4242`
  - Expiry: Any future date (e.g. `12/28`) | CVC: `123` | ZIP: `90210`
  - Declining Card: `4000 0000 0000 0002` (Card Declined test)
- **Redis Keys & Namespaces:**
  - Distributed lock: `mkt:lock:request:<requestId>`
  - Rate limiting: `rate:auth:<ip>`
  - Socket rooms: `providers`, `user:<userId>`, `conversation:<conversationId>`

---

## 5. Severity Rubric

- **Critical:** Blocks a core marketplace flow entirely for any role (e.g., cannot register/login, cannot create request, cannot submit offer, cannot accept offer, double-acceptance occurs, or exploitable security/auth-bypass).
- **High:** Degrades a core flow significantly (e.g., real-time messaging fails to broadcast to counterparty, server crashes with 500 on valid edge inputs, broken status transition, data corruption, or role-based access control gap).
- **Medium:** Non-blocking functional bug, unhandled recoverable error, missing validation that doesn't lead to database corruption, responsive layout gap that hides navigation, or missing rate-limiting safeguards.
- **Low:** Cosmetic issue, copy/label mismatch, minor validation message discrepancy, or non-blocking usability friction.

---

## 6. Audit Scope & Verification Checklist

### Scope 1: Authentication & Role-Based Access Control (`FEAT-001`)
- [ ] **Registration (`POST /api/auth/register`):**
  - Customer and Provider role toggle properly sets role.
  - Password hashing with bcrypt (cost factor >= 10).
  - Validation: Email format, name min 2 chars, password min 8 chars.
  - Email normalization: Whitespace trimmed and normalized to lowercase.
  - Duplicate email returns HTTP 409 Conflict.
  - Rate limiting: Max 10 requests per minute per IP (HTTP 429 Too Many Requests).
- [ ] **Login (`POST /api/auth/login`):**
  - Valid credentials return signed JWT (`{ sub, email, role }`) and user record without `passwordHash`.
  - Invalid credentials return HTTP 401 Unauthorized with user-friendly alert.
  - Rate limiting: Max 10 requests per minute per IP.
- [ ] **Profile (`GET /api/auth/me`):**
  - Valid token returns user entity without `passwordHash`.
  - Missing or expired token returns HTTP 401.
- [ ] **Guards & RBAC:**
  - `@Roles('customer')` blocks provider with HTTP 403 Forbidden.
  - `@Roles('provider')` blocks customer with HTTP 403 Forbidden.
- [ ] **Client Session Handling:**
  - Stored token under `auth_token` in `localStorage`.
  - Expired token is evicted cleanly with notification (`/login?reason=expired`).
  - Unauthenticated routes gracefully redirect to `/login`.

### Scope 2: Service Requests Management & Real-Time Broadcast (`FEAT-002`)
- [ ] **Request Creation (`POST /api/requests`):**
  - Restricted to `customer` role (`@Roles('customer')`).
  - Input validation: Title (3-100 chars), Description (10-2000 chars), Budget (>= $1.00 USD).
  - Whitespace-only title or description trimmed and rejected with HTTP 400 Bad Request.
  - Successful creation initializes status `OPEN` and emits `request:created` over Socket.IO.
- [ ] **Request Listing & Queries:**
  - `GET /api/requests`: Paginated list of open requests (capped at 50 max per page, default 20).
  - `GET /api/requests/my-requests`: Customer's private requests with ownership filter.
  - `GET /api/requests/:id`: Single request details; invalid ObjectId returns HTTP 400; non-existent returns HTTP 404.
- [ ] **Real-Time Broadcast (`FEAT-002-INT`):**
  - Connected providers auto-join room `providers`.
  - `request:created` event arrives on connected providers' dashboards within 200ms without page refresh.
  - Customer sockets do NOT receive the broadcast in `providers` room.

### Scope 3: Offers & Concurrency-Guarded Acceptance (`FEAT-003`)
- [ ] **Offer Submission (`POST /api/requests/:id/offers`):**
  - Restricted to `provider` role (`@Roles('provider')`).
  - Request must have status `OPEN`; closed/accepted requests reject offers with HTTP 400.
  - Customer cannot submit an offer on their own request (HTTP 400).
  - Price validation: Price >= $1.00 USD, message 5-1000 chars.
  - Whitespace-only message trimmed and rejected with HTTP 400 Bad Request.
  - Real-time `offer:created` emitted to customer's private room `user:<customerId>` with `{ offer, requestTitle }`.
- [ ] **Offer Listing (`GET /api/requests/:id/offers`):**
  - Paginated list of offers for the request, sorted newest first (capped at 50 max per page).
- [ ] **Concurrency-Guarded Acceptance (`POST /api/offers/:id/accept`):**
  - Customer ownership verified (`request.customerId === req.user.id`).
  - Tier 1: Redis distributed lock (`mkt:lock:request:<requestId>`, 10s TTL).
  - Tier 2: Atomic MongoDB conditional mutation (`findOneAndUpdate({ _id: requestId, status: 'OPEN' })`).
  - On success: Winning offer -> `ACCEPTED`, Peer offers -> `REJECTED`, Request -> `ACCEPTED`.
  - Concurrency Race Test: 10 parallel acceptance requests hitting Node 1 and Node 2 simultaneously result in exactly 1 HTTP 200 OK and 9 HTTP 409 Conflicts. Zero orphaned locks.
  - Real-time `offer:accepted` dispatched to winning provider; `request:closed` broadcast to `providers` room.

### Scope 4: Stripe Payments & Idempotent Webhook Engine (`FEAT-004`)
- [ ] **PaymentIntent Creation (`POST /api/payments/create-intent`):**
  - Caller must be customer owner of the accepted offer.
  - Amount calculated strictly on backend from accepted offer price (`amount = Math.round(price * 100)` cents). Frontend amount is ignored.
  - Request and offer must be in `ACCEPTED` status.
- [ ] **Webhook Signature Verification (`POST /api/payments/webhook`):**
  - Verifies raw-body HMAC-SHA256 signature via `stripe.webhooks.constructEvent`.
  - Tampered or missing signature returns HTTP 400 Bad Request.
- [ ] **Webhook Idempotency (`processed_events` table):**
  - On `payment_intent.succeeded`: Payment transitions to `SUCCEEDED`, request transitions to `PAID`, real-time `payment:succeeded` emitted.
  - Idempotency Replay Test: Sending the exact same webhook event 3 consecutive times returns HTTP 200 OK with zero duplicate state mutations or duplicate emissions.
  - On `payment_intent.payment_failed`: Payment transitions to `FAILED`, request remains `ACCEPTED` allowing customer to retry.

### Scope 5: Real-Time Chat & Server-Side Room Authorization (`FEAT-005`)
- [ ] **Conversation Model & Persistence:**
  - Conversation automatically created upon offer acceptance linking Customer and winning Provider.
  - Message entity persists in MongoDB (`conversationId`, `senderId`, `content`, `createdAt`).
  - Message history endpoint (`GET /api/conversations/:id/messages`) paginated in reverse chronological order (limit default 30, max 50).
- [ ] **Zero-Trust Room Authorization:**
  - Socket event `conversation:join` checks MongoDB to ensure `user.id === customerId || user.id === providerId`.
  - Unauthorized third-party users (including losing providers) are denied entry with an error callback.
- [ ] **Dual-Path Real-Time Message Delivery:**
  - Both socket `message:send` and REST `POST /api/conversations/:id/messages` broadcast `message:new` over Redis Pub/Sub adapter to all connected conversation peers.
  - Persistence-first invariant: Message must be saved to MongoDB before or upon broadcast.

### Scope 6: Horizontal Scaling & Docker Topology (`FEAT-006`)
- [ ] **Dual Backend Instances (Node 1 on 3001, Node 2 on 3002):**
  - Socket.IO Redis Pub/Sub adapter synchronizes events across both instances.
  - Client A on Node 1 receives real-time events emitted by Client B on Node 2.
- [ ] **Nginx Reverse Proxy (Port 8080):**
  - Routes `/api/*` and upgrades `/socket.io/*` with sticky `ip_hash`.
- [ ] **Docker Compose:**
  - All 6 services (Next.js, Node 1, Node 2, MongoDB, Redis, Nginx) start cleanly via `docker compose up`.

### Scope 7: End-to-End Marketplace Lifecycle (`EPIC-001`)
- [ ] **Full 7-Step Journey:**
  1. Registration and login for Customer and 2 Providers.
  2. Customer creates request -> Providers receive `request:created`.
  3. Both providers submit competing offers -> Customer receives `offer:created`.
  4. Concurrent acceptance attack -> Exactly 1 accepted, other rejected with HTTP 409.
  5. Customer pays via Stripe -> Webhook transitions request to `PAID`.
  6. Customer and winning provider chat in real time across different NestJS nodes.
  7. Losing provider is rejected when attempting to join or read the chat room.

### Scope 8: Responsive Layout, Navigation & Accessibility
- [ ] **Navigation Bar (`NavigationBar`):**
  - Responsive hamburger menu for mobile viewports (< 640px).
  - Dynamic role badge (`CUSTOMER` in indigo, `PROVIDER` in amber).
  - Live socket connection indicator (green pulsing dot when live, gray when disconnected).
- [ ] **Accessibility (WCAG 2.1 AA):**
  - Keyboard navigation (Tab/Shift+Tab, Enter/Space).
  - Modal focus trapping and Escape key closing in `SubmitOfferDialog` and `PaymentModal`.
  - Screen reader labels (`aria-labelledby`, `role="status"`, `role="alert"`).

---

## 7. Regression Verification Matrix for Pre-Identified Issues

This matrix audits the 10 previously identified and fixed defects to ensure zero regressions:

| Issue ID | Defect Description | Target Area | Regression Verification Check |
| :--- | :--- | :--- | :--- |
| **ISSUE-001** | Whitespace-only title/description caused HTTP 500 | `POST /api/requests` | Verify `@Transform(trim)` & `@MinLength` returns HTTP 400 on whitespace |
| **ISSUE-002** | Whitespace-only offer message caused HTTP 500 | `POST /api/requests/:id/offers` | Verify `@Transform(trim)` & `@MinLength(5)` returns HTTP 400 on whitespace |
| **ISSUE-003** | Missing rate limiting on user registration | `POST /api/auth/register` | Verify `@Throttle({ default: { limit: 10, ttl: 60000 } })` blocks 11th request with HTTP 429 |
| **ISSUE-004** | Mobile navigation links hidden without menu | `NavigationBar` (<640px) | Verify hamburger menu toggles mobile drawer with all navigation links |
| **ISSUE-005** | Missing client-side dashboard route protection | `/customer/*`, `/provider/*` | Verify unauthenticated or wrong-role users redirect to `/login` |
| **ISSUE-006** | Fractional budget validation discrepancy | `CreateRequestForm` | Verify minimum budget is strictly $1.00 USD on both client and server |
| **ISSUE-007** | Silent session eviction on expired JWT | `AuthProvider` | Verify redirect to `/login?reason=expired` with alert notification |
| **ISSUE-008** | Chat broadcast bypassed by HTTP POST in ChatWindow | `ChatController` & `ChatGateway` | Verify `ChatController` broadcasts `message:new` across Redis adapter on HTTP POST |
| **ISSUE-009** | Fractional offer price validation discrepancy | `SubmitOfferDialog` | Verify minimum offer price is strictly $1.00 USD (`min="1.00"`, `parsedPrice < 1`) |
| **ISSUE-010** | Inconsistent WebSocket URL env resolution | `SocketProvider` | Verify `NEXT_PUBLIC_SOCKET_URL` is prioritized with fallback |

---

## 8. Technical Review & Architectural Defense Readiness (`Project-scope.md` Section 17)

The system must be prepared to answer and demonstrate the following technical review questions:
- [ ] **Socket.IO Rooms & Scalability:** Explain how rooms work (`providers`, `user:<id>`, `conversation:<id>`), how WebSocket handshakes are authenticated via JWT, and how events reach clients connected to different backend instances via Redis Pub/Sub adapter.
- [ ] **Redis Strategy & Failure Scenarios:** Explain Redis Pub/Sub adapter configuration, distributed locking with Lua release, and behavior if Redis crashes (failover to MongoDB atomic conditional mutation fallback).
- [ ] **MongoDB Indexing & Concurrency:** Explain compound indexes (`status, customerId`, `requestId, status`, `conversationId, createdAt`) and atomic conditional mutation (`findOneAndUpdate({ _id: requestId, status: 'OPEN' })`).
- [ ] **Stripe Payments Architecture:** Explain payment lifecycle, why frontend payment success cannot be trusted, cryptographic signature verification, and idempotency (`processed_events`).
- [ ] **Horizontal Scaling & Statelessness:** Explain how NestJS nodes remain completely stateless, session management, and bottlenecks at larger scale.

---

## 9. QA Audit Execution Protocol

Follow these 5 procedural phases during execution:

1. **Phase 1: Automated Test Suite Execution:**
   - Run `npm run test:backend`, `npm run test:ui`, `npm run test:e2e`, and typechecks. Record pass/fail counts and test durations.
2. **Phase 2: Static Contract & Security Boundary Auditing:**
   - Verify DTO transforms, trim decorators, `@Min` constraints, environment variable names, and error handling filters.
3. **Phase 3: Live End-to-End Multi-Role Workflow Auditing:**
   - Audit customer request creation, provider offer submission, concurrency acceptance, Stripe checkout modal, and chat messaging.
4. **Phase 4: Edge Case & Fault Injection Testing:**
   - Test sub-dollar inputs ($0.01 to $0.99), whitespace strings, duplicate webhook replays, declined test cards, and cross-tenant chat eavesdropping.
5. **Phase 5: Issue Authoring & Index Synchronization:**
   - Author a discrete Markdown file in `/issues` named `ISSUE-XXX-short-slug.md` for every defect found.
   - Synchronize `/issues/ISSUES-INDEX.md` with updated totals and action items.

---

## 10. Issue Reporting Template

For every identified defect, create `Issues/ISSUE-XXX-short-slug.md` using this exact structure:

```markdown
# ISSUE-XXX: <Short descriptive title>

## Summary
One or two sentences describing the defect or gap.

## Location / Flow
Where in the app this occurs, including role and URL path.

## Steps to Reproduce
1. ...
2. ...
3. ...

## Expected Behavior
What the spec or standard UX/security practice requires.

## Actual Behavior
What actually occurs.

## Severity
Critical / High / Medium / Low — per the Severity Rubric.

## Category
(Navigation / Auth / Forms / CRUD / Payments / Security / Real-Time / Accessibility / Usability / Performance)

## Scope
- **In Scope:** What this issue covers.
- **Out of Scope:** Deliberate exclusions.

## Acceptance Criteria
- [ ] Condition 1
- [ ] Condition 2

## Related Feature/Ticket ID
(e.g., FEAT-001, FEAT-002, etc.)

## Status
Open

## Notes
Technical details, logs, or code references.
```
