# Real-Time Service Marketplace (FlogenAI) — QA Audit & Testing Plan (v2)

> **About this Document:** This document serves as the project-tailored QA audit specification, execution script, and quality assurance framework for the Real-Time Service Marketplace (FlogenAI). It is derived from `context/project-overview.md`, `context/feature-specs/Project-scope.md`, `context/architecture.md`, `000-shared-contracts.md`, and all feature specifications (`FEAT-001` through `FEAT-006`, and `EPIC-001`).

---

## Project Context

- **Project name:** Real-Time Service Marketplace (FlogenAI)
- **Tech stack:** 
  - **Frontend:** Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS)
  - **Backend:** NestJS (TypeScript, Node.js, Express)
  - **Database:** MongoDB 6.0 (Mongoose ODM)
  - **Cache / Broker / Locks:** Redis 7.0 (ioredis, @socket.io/redis-adapter)
  - **Payments:** Stripe (Node.js SDK, Stripe Elements, Test Mode)
  - **Load Balancer / Reverse Proxy:** Nginx (Alpine) with sticky IP-hash and WebSocket upgrade forwarding
  - **Orchestration:** Docker & Docker Compose
- **Spec / Reference docs:**
  - `context/project-overview.md`
  - `context/feature-specs/Project-scope.md`
  - `context/architecture.md`
  - `context/code-standards.md`
  - `context/testing-strategy.md`
  - `context/ui-context.md`
  - `context/feature-specs/000-shared-contracts.md`
  - `context/feature-specs/000-nonfunctional-contracts.md`
  - `context/feature-specs/000-infra-contracts.md`
  - Feature specs: `FEAT-001` (Auth), `FEAT-002` (Requests), `FEAT-003` (Offers/Concurrency), `FEAT-004` (Stripe), `FEAT-005` (Chat), `FEAT-006` (Scaling), and `EPIC-001` (Lifecycle).
- **User roles in this app:**
  - `customer`: Authors service requests, receives real-time bids, accepts single winning offer under distributed lock, executes Stripe payments, and chats with the accepted provider.
  - `provider`: Browses open marketplace requests, submits competitive price/proposal offers, receives acceptance notifications, and chats with customer after acceptance.
  - `guest` (Unauthenticated): Views landing page and public marketplace feeds; restricted from mutations, offers, payments, and chat.
- **Core domain flows:**
  1. **Authentication & Role-Based Access Control:** Registration and login for Customer and Provider, bcrypt hashing, JWT issuance, REST route guards (`@Roles`), Socket.IO handshake authentication, and rate limiting.
  2. **Service Request Publication & Real-Time Broadcast:** Customer creates service request (Title, Description, Budget). Backend emits `request:created` via Socket.IO/Redis Pub/Sub adapter to the shared `providers` room across dual NestJS instances.
  3. **Offer Submission & Distributed Concurrency Lock:** Connected providers submit offers. Customer receives `offer:created` in private room `user:<id>`. Customer accepts an offer: Redis distributed lock (`mkt:lock:request:<id>`) + MongoDB atomic conditional mutation (`findOneAndUpdate({ _id: id, status: 'OPEN' })`) physically prevents double-acceptance across distributed nodes. Winning offer marked `ACCEPTED`, peers marked `REJECTED`, and real-time `offer:accepted` & `request:closed` events broadcast.
  4. **Server-Calculated Stripe Payment & Idempotent Webhook:** Backend validates accepted offer and creates Stripe PaymentIntent (strictly server-enforced amount). Customer checks out via Stripe Elements. Webhook verifies cryptographic HMAC-SHA256 signature, enforces idempotency against `processed_events` table (zero duplicate side-effects on replay), transitions request to `PAID`, and unlocks chat.
  5. **Authorized Real-Time Chat:** Customer and Provider join `conversation:<id>` with strict server-side participant authorization. Persistence-first invariant: messages saved to MongoDB before broadcasting `message:new` across cluster instances. Unrelated users are denied room access.
  6. **Horizontal Scaling & Multi-Node Cluster:** Dual NestJS backend instances (Port 3001 & Port 3002) synchronized via Redis Pub/Sub behind an Nginx reverse proxy load balancer (Port 8080).
- **Environment(s) to test:**
  - **Multi-Instance Docker Cluster:**
    - Next.js 16 Frontend: `http://localhost:3000`
    - Nginx Load Balancer: `http://localhost:8080` (API routes `/api/*` and WebSocket `/socket.io/*`)
    - NestJS Backend Instance 1: `http://localhost:3001`
    - NestJS Backend Instance 2: `http://localhost:3002`
    - MongoDB: `localhost:27017`
    - Redis: `localhost:6379`
  - **Automated Test Environments:**
    - Monorepo unit/API/concurrency suites: `npm run test:backend` (Jest)
    - Monorepo Fake DOM / UI suites: `npm run test:ui` (Vitest + React Testing Library)
    - End-to-End Lifecycle suite: `npm run test:e2e` (Jest E2E runner)
    - Multi-node cluster verification: `npm run verify:cluster` (ts-node)
- **Out of current scope:** Live Stripe production charges/disputes, video/audio chat, chat file attachments, third-party social logins (OAuth), public marketing pages beyond minimal landing page, unbounded search engines (Elasticsearch).

---

## Test Data & Access

- **Test accounts per role:**
  - `customer`: `customer@test.com` / `Password123!` (or dynamically provisioned `qa-customer@test.com`)
  - `provider` (1): `provider1@test.com` / `Password123!` (or dynamically provisioned `qa-provider1@test.com`)
  - `provider` (2): `provider2@test.com` / `Password123!` (or dynamically provisioned `qa-provider2@test.com`)
  - `guest`: Unauthenticated visitor (no credentials)
- **Seed data assumptions:**
  - Initial service request: Title: "Fix Kitchen Plumbing", Description: "Need urgent repair on leaking kitchen sink pipe.", Budget: $150.00, Status: `OPEN`, owned by Customer.
  - Seed command: `npm run seed` or automated fixture initialization.
- **Sandbox/test credentials for third parties:**
  - Stripe Test Card Number: `4242 4242 4242 4242`
  - Expiration Date: Any future month/year (e.g., `12/28`)
  - CVC: `123`
  - ZIP: `90210`
  - Stripe Webhook Signing Secret: `whsec_...` or test secret `test_webhook_secret`
- **Reset procedure:**
  - For Docker environment: `docker compose down -v && docker compose up -d` or executing test scripts with unique timestamped identities (`qa-${Date.now()}@test.com`).

---

## Role & Objective

You are a senior QA engineer performing a comprehensive functional, navigational, security, and usability audit of the FlogenAI Real-Time Service Marketplace.

**Goal:** Systematically trace every clickable element, route, form, API endpoint, Socket.IO event, and distributed user flow across Customer, Provider, and Guest roles, verify each against expected behavior, and log every defect, inconsistency, or missing safeguard as a discrete issue file in `/issues` using the standard format.

---

## Severity Rubric

- **Critical:** Blocks a core marketplace flow entirely for any role (cannot register/login, cannot create request, cannot submit offer, cannot accept offer, double-acceptance occurs, or exploitable security/auth-bypass).
- **High:** Degrades a core flow significantly (e.g., server crashes with 500 on valid edge inputs, broken status transition, data corruption, or role-based access control gap).
- **Medium:** Non-blocking functional bug, unhandled recoverable error, missing validation that doesn't lead to database corruption, responsive layout gap that hides navigation, or missing rate-limiting safeguards.
- **Low:** Cosmetic issue, copy/label mismatch, minor validation message discrepancy, or non-blocking usability friction.

## Non-Invasive Security Boundary

Non-invasive security checks verify:
- Input sanitization and escaping (e.g., submitting `<script>alert(1)</script>` into request titles, descriptions, offer proposals, or chat inputs to confirm they render escaped as plain text).
- Server-side authorization enforcement on REST endpoints (`@Roles`, ownership validation) and Socket.IO handshakes / rooms (`conversation:join` verification).
- Rate-limiting headers or HTTP 429 lockout responses after rapid repeated attempts on auth endpoints.
- Absence of exposed JWT secrets, Stripe secret keys, or raw credit card data.

---

## Audit Scope & Verification Checklist

### 1. Global Navigation & Layout
- Header / Navigation Bar (`NavigationBar`):
  - Brand logo links to `/`.
  - Role pill displays `CUSTOMER` (indigo) or `PROVIDER` (amber).
  - Socket.IO connection pill reflects live status (green pulsing dot when connected, gray when disconnected).
  - Navigation links: `My Requests` for Customer, `Browse Marketplace` for Provider.
  - Mobile responsiveness: Test at ~375px (iPhone), ~768px (Tablet), and desktop. Confirm whether navigation links remain accessible or if a mobile menu is required.
  - Logout action: Clears token from `localStorage`, resets auth context, disconnects socket, and redirects to `/login`.

### 2. Authentication & Account Management
- Registration (`/register` & `RegisterForm`):
  - Customer vs. Provider role toggle.
  - Client-side validation: Name (min 2 chars), Email (valid email format), Password (min 8 chars).
  - Server-side validation via `RegisterDto`.
  - Duplicate email handling: Returns HTTP 409 Conflict with clear error message.
  - Rate limiting on `POST /api/auth/register`: Must enforce 10 requests/minute per IP.
- Login (`/login` & `LoginForm`):
  - Valid credentials authenticate and redirect according to role (`customer` -> `/customer/requests`, `provider` -> `/provider/browse`).
  - Invalid credentials return HTTP 401 Unauthorized with "Invalid email or password" alert.
  - Rate limiting on `POST /api/auth/login`: 10 requests/minute (returns HTTP 429 Too Many Requests).
- Session Persistence & Expiry:
  - Token stored in `localStorage` under `flogen_token`.
  - On page refresh, `AuthProvider` validates token via `GET /api/auth/me`.
  - If token is expired or malformed, session must clear cleanly with appropriate feedback.
- Role-Based Access Control (RBAC):
  - Provider attempting to access customer endpoints (`POST /api/requests`, `GET /api/requests/my-requests`, `POST /api/offers/:id/accept`) receives HTTP 403 Forbidden.
  - Customer attempting to submit an offer (`POST /api/requests/:id/offers`) receives HTTP 403 Forbidden.
  - Client-side routes (`/customer/requests`, `/provider/browse`): Unauthenticated visitors and unauthorized roles should be gracefully redirected or gated.

### 3. Core Domain Flows (End-to-End per Role)
- **Customer Journey:**
  1. Login as Customer.
  2. Navigate to `/customer/requests`.
  3. Fill out `CreateRequestForm` (Title: 3-100 chars, Description: 10-2000 chars, Budget > 0).
  4. Submit form: Request immediately prepended to local list and broadcast to providers.
  5. Click request to open `/requests/[id]`.
  6. Receive real-time `offer:created` event from provider bids (with arrival banner and glow highlight).
  7. Click "Accept Offer" on chosen bid.
  8. Verify concurrency lock: Winning offer transitions to `ACCEPTED`, peers transition to `REJECTED`, request transitions to `ACCEPTED`.
  9. Click "Proceed to Payment": Opens `PaymentModal` with backend-verified offer price.
  10. Complete Stripe test card payment: Request status updates to `PAID`, unlocking the "Open Chat" banner.
  11. Click "Open Chat": Navigates to `/chat/[requestId]`, exchanges real-time messages with the provider.
- **Provider Journey:**
  1. Login as Provider.
  2. Navigate to `/provider/browse`.
  3. View open requests feed; observe live arrival of new requests via `request:created`.
  4. Click on an open request to open `/requests/[id]`.
  5. Click "Submit Offer": Opens `SubmitOfferDialog`.
  6. Submit price and proposal message.
  7. When customer accepts offer: Receive real-time `offer:accepted` event; request updates to `ACCEPTED`.
  8. Once customer completes payment: Chat is unlocked; provider navigates to `/chat/[requestId]` to communicate.

### 4. Forms & Data Input Validation Edge Cases
- `CreateRequestForm`:
  - Empty fields: Trigger client-side validation errors.
  - Whitespace-only input: Submitting `"   "` for title or `"          "` for description. Verify server rejects with HTTP 400 Bad Request rather than crashing with HTTP 500.
  - Budget boundaries: Test `$0.00`, negative values (`-50`), non-numeric strings, and fractional values below $1.00 (e.g., `$0.50`). Check consistency between client validation and backend `@Min(1)`.
  - Max lengths: Title > 100 characters, Description > 2000 characters.
  - XSS strings: `<script>alert('xss')</script>` in title/description must render escaped as text.
- `SubmitOfferDialog`:
  - Empty or negative price: Blocked client-side and server-side (`@Min(1)`).
  - Whitespace-only message: Verify server rejects with HTTP 400 instead of HTTP 500.
  - Self-offer prevention: Customer attempting to submit offer on their own request must return HTTP 400.
- `ChatInput`:
  - Enter key sends message; Shift+Enter creates newline.
  - Whitespace-only message: Send button disabled; no empty message persisted or emitted.
  - Max length: 2000 characters enforced.
  - Input cleared immediately on submission to prevent double-send.

### 5. Dashboards, Lists & Data Views
- Pagination:
  - Verify limit is capped at 50 records max across `GET /api/requests`, `GET /api/requests/:id/offers`, `GET /api/conversations/:id/messages`.
- Empty states:
  - Zero customer requests: Displays "No service requests found" card.
  - Zero open provider requests: Displays "No service requests found" empty state.
  - Zero offers: Displays "No offers submitted yet" placeholder.
  - Zero chat messages: Displays "No messages yet. Say hello to start the conversation."
- Loading states:
  - Skeletons and spinners appear during network transit and clear on load.
- Real-time updates:
  - `request:created`: Prepended to provider feed with flash animation.
  - `offer:created`: Appended to customer offer list with glow animation.
  - `request:closed`: Updates status to ACCEPTED on provider browse page.
  - `payment:succeeded`: Updates badge to PAID and reveals chat button without page refresh.

### 6. CRUD Operations & State Machine Transitions
- Service Request status transitions: `OPEN` -> `ACCEPTED` -> `PAID` -> `COMPLETED` / `CANCELLED`.
- Offer status transitions: `PENDING` -> `ACCEPTED` or `REJECTED`.
- Atomic rollback: If offer acceptance fails midway, no partial state transitions persist.

### 7. Payments & Webhook Idempotency
- Server-determined amounts:
  - `POST /api/payments/create-intent` takes only `offerId`. Frontend never supplies monetary amounts.
  - Backend verifies caller is customer owner and offer is `ACCEPTED`.
- Webhook signature verification:
  - `POST /api/payments/webhook` verifies raw body HMAC-SHA256 signature via `stripe.webhooks.constructEvent`.
  - Requests with missing or altered signature return HTTP 400.
- Webhook idempotency (`processed_events`):
  - Duplicate delivery of the exact same Stripe event ID returns HTTP 200 OK with zero duplicate state transitions or duplicate emissions.

### 8. Notifications & Real-Time Communications
- Socket.IO handshakes:
  - Valid JWT required in handshake `auth.token` or `Authorization: Bearer <token>`. Unauthenticated sockets disconnected.
- Room isolation:
  - Providers join `providers` room.
  - All users auto-join `user:<userId>` private room.
  - Chat rooms `conversation:<conversationId>` require server-side participant check. Unauthorized sockets are rejected with error and denied entry.

### 9. Concurrency & Race Condition Suite
- 10 Parallel simultaneous offer acceptance requests fired across Node 1 and Node 2 at the exact same millisecond:
  - Exactly 1 request succeeds with HTTP 200 OK.
  - 9 requests rejected with HTTP 409 Conflict.
  - Database records exactly 1 accepted offer. Zero orphaned Redis locks.

### 10. Accessibility (WCAG 2.1 AA)
- Keyboard navigation: All inputs, buttons, dialogs accessible via Tab / Shift+Tab.
- Focus trap and Escape key handling in `SubmitOfferDialog` and `PaymentModal`.
- Screen reader labels: Form inputs linked to `<label htmlFor="...">`, status alerts decorated with `role="alert"` or `aria-live`.

---

## Deliverable & Issue Reporting Format

For every issue identified during execution, author a dedicated Markdown file in `/issues` named `ISSUE-XXX-short-slug.md` matching this template:

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
(Navigation / Auth / Forms / CRUD / Payments / Security / Accessibility / Usability / Performance)

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

Upon completing the audit, generate `ISSUES-INDEX.md` in `/issues` listing all issues grouped by severity.
