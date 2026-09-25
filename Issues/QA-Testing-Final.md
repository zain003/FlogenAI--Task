# Real-Time Service Marketplace (FlogenAI) — QA Audit & Testing Plan (v3)

> **About this Document:** This document serves as the project-tailored QA audit specification, execution script, and quality assurance framework for the Real-Time Service Marketplace (FlogenAI). It is derived from `context/project-overview.md`, `context/feature-specs/Project-scope.md`, `context/architecture.md`, `000-shared-contracts.md`, `000-nonfunctional-contracts.md`, `000-infra-contracts.md`, and all feature specifications (`FEAT-001` through `FEAT-006`, and `EPIC-001`).

---

## 1. Project Context & Architectural Foundation

- **Project name:** Real-Time Service Marketplace (FlogenAI)
- **Tech stack:**
  - **Frontend:** Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS, Lucide React)
  - **Backend:** NestJS 10 (TypeScript, Node.js, Express, Passport JWT, Mongoose, Throttler)
  - **Database:** MongoDB 6.0 (Mongoose ODM, compound indexes, atomic conditional operations)
  - **Cache / Broker / Locks:** Redis 7.0 (`redis` client, `@socket.io/redis-adapter`, distributed mutex locks with atomic Lua release)
  - **Payments:** Stripe Test Mode (Stripe Node.js SDK, Stripe Elements via `@stripe/react-stripe-js`, cryptographic webhook HMAC-SHA256 signature verification)
  - **Load Balancer / Reverse Proxy:** Nginx (Alpine) with sticky `ip_hash` upstream and WebSocket upgrade protocol forwarding
  - **Orchestration:** Docker & Docker Compose
- **Specification & Reference Documents:**
  - `context/project-overview.md`
  - `context/feature-specs/Project-scope.md`
  - `context/architecture.md`
  - `context/code-standards.md`
  - `context/testing-strategy.md`
  - `context/ui-context.md`
  - `context/feature-specs/000-shared-contracts.md`
  - `context/feature-specs/000-nonfunctional-contracts.md`
  - `context/feature-specs/000-infra-contracts.md`
  - `context/feature-specs/INDEX.md` & `context/progress-tracker.md`
  - Feature specs: `FEAT-001` (Auth), `FEAT-002` (Requests), `FEAT-003` (Offers/Concurrency), `FEAT-004` (Stripe), `FEAT-005` (Chat), `FEAT-006` (Scaling), and `EPIC-001` (Lifecycle Journey).

---

## 2. User Roles & Access Boundaries

- **`customer`**:
  - Authors service requests (`title`: 3-100 chars, `description`: 10-2000 chars, `budget` >= $1.00 USD).
  - Receives real-time bids via private room `user:<userId>` (`offer:created`).
  - Accepts a single winning offer under distributed lock protection (`mkt:lock:request:<id>`).
  - Initiates server-calculated Stripe PaymentIntents (client cannot tamper with pricing).
  - Executes test checkout via Stripe Elements.
  - Chats with the accepted provider after payment confirmation (`conversation:<conversationId>`).
- **`provider`**:
  - Browses open marketplace requests in a real-time feed with live `request:created` and `request:closed` event streaming.
  - Submits competitive price and proposal offers (`price` >= $1.00 USD, `message`: 5-1000 chars).
  - Receives real-time acceptance notifications (`offer:accepted`).
  - Chats with the customer in real time after acceptance and payment.
- **`guest` (Unauthenticated)**:
  - Can view the landing page and public marketplace feeds.
  - Gated from mutations, request publishing, offer submissions, Stripe checkouts, and chat rooms (receives HTTP 401 or client-side login redirect).

---

## 3. Test Environments & Automated Test Commands

### Multi-Instance Docker Infrastructure Topology
- **Next.js 16 Frontend:** `http://localhost:3000`
- **Nginx Reverse Proxy / Load Balancer:** `http://localhost:8080`
  - API routes: `http://localhost:8080/api/*`
  - Socket.IO gateway: `ws://localhost:8080/socket.io/*`
- **NestJS Backend Node 1:** `http://localhost:3001`
- **NestJS Backend Node 2:** `http://localhost:3002`
- **MongoDB:** `localhost:27017` (database: `marketplace`)
- **Redis:** `localhost:6379` (pub/sub adapter and distributed locks)

### Automated Test Suites Execution Commands
```bash
# 1. Backend Multi-Layer Test Suite (Jest: 21 suites, 222+ tests)
npm run test:backend

# 2. Frontend Fake DOM / Component Test Suite (Vitest + React Testing Library: 13 suites, 73+ tests)
npm run test:ui

# 3. Full Marketplace End-to-End Lifecycle Suite (Jest E2E Runner: 7 journey steps)
npm run test:e2e

# 4. TypeScript Static Typecheck Verification
npm run typecheck:backend
npm run typecheck:frontend

# 5. Multi-Instance Cluster Synchronization Verification (ts-node)
npm run verify:cluster
```

---

## 4. Test Data, Credentials & Seed State

- **Standard Test Accounts:**
  - `customer`: `customer@test.com` / `Password123!` (or dynamic fixture `qa-cust-${Date.now()}@test.com`)
  - `provider 1`: `provider1@test.com` / `Password123!` (or dynamic fixture `qa-prov1-${Date.now()}@test.com`)
  - `provider 2`: `provider2@test.com` / `Password123!` (or dynamic fixture `qa-prov2-${Date.now()}@test.com`)
  - `guest`: Unauthenticated visitor (no credentials)
- **Token Storage Key:** `auth_token` in browser `localStorage` (managed via `ApiClient` and `AuthProvider`).
- **Seed Data Assumptions:**
  - Initial service request: Title: "Fix Kitchen Plumbing", Description: "Need urgent repair on leaking kitchen sink pipe.", Budget: $150.00, Status: `OPEN`, owned by Customer.
- **Stripe Sandbox Credentials:**
  - Card Number: `4242 4242 4242 4242`
  - Expiry: Any future date (e.g., `12/28`)
  - CVC: `123` | ZIP: `90210`
  - Webhook Signing Secret: `whsec_...` or local test secret `whsec_placeholder_secret_for_testing`
- **Redis Keys & Namespaces:**
  - Distributed lock: `mkt:lock:request:<requestId>`
  - Rate limiting: `mkt:rate:<ip>` or NestJS Throttler memory/Redis storage
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
  - Duplicate email returns HTTP 409 Conflict.
  - Rate limiting: Max 10 requests per minute per IP (HTTP 429 Too Many Requests).
- [ ] **Login (`POST /api/auth/login`):**
  - Valid credentials return signed JWT (`{ sub, email, role }`) and user record.
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
  - Whitespace-only title or description must be trimmed and rejected with HTTP 400 Bad Request.
  - Successful creation initializes status `OPEN` and emits `request:created` over Socket.IO.
- [ ] **Request Listing & Queries:**
  - `GET /api/requests`: Paginated list of open requests (capped at 50 max per page).
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
  - Real-time `offer:created` emitted to customer's private room `user:<customerId>` with `{ offer, requestTitle }`.
- [ ] **Offer Listing (`GET /api/requests/:id/offers`):**
  - Paginated list of offers for the request, sorted newest first.
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
  - Amount calculated strictly on backend from accepted offer price (`amount = price * 100` cents). Frontend amount is ignored.
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
- [ ] **Real-Time Message Delivery:**
  - Sending message from customer must immediately broadcast `message:new` to provider in room `conversation:<conversationId>` across cluster instances.
  - Verify whether frontend `ChatWindow` sends via Socket.IO `message:send` or REST, and verify that real-time broadcast is delivered to the counterparty.
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

## 7. QA Audit Execution Protocol

Follow these 5 procedural phases during execution:

1. **Phase 1: Automated Test Suite Execution:**
   - Run `npm run test:backend`, `npm run test:ui`, `npm run test:e2e`, and typechecks. Record pass/fail counts and test durations.
2. **Phase 2: Static Contract & Security Boundary Auditing:**
   - Verify DTO transforms, trim decorators, `@Min` constraints, and environment variable names (`NEXT_PUBLIC_SOCKET_URL` vs `NEXT_PUBLIC_WS_URL`).
3. **Phase 3: Live End-to-End Multi-Role Workflow Auditing:**
   - Audit customer request creation, provider offer submission, concurrency acceptance, Stripe checkout modal, and chat messaging.
4. **Phase 4: Edge Case & Fault Injection Testing:**
   - Test sub-dollar inputs ($0.01 to $0.99), whitespace strings, duplicate webhook replays, declined test cards, and cross-tenant chat eavesdropping.
5. **Phase 5: Issue Authoring & Index Synchronization:**
   - Author a discrete Markdown file in `/issues` named `ISSUE-XXX-short-slug.md` for every defect found.
   - Synchronize `/issues/ISSUES-INDEX.md` with updated totals and action items.

---

## 8. Issue Reporting Template

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
