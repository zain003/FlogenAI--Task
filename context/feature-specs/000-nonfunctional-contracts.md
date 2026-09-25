# 000-nonfunctional-contracts.md — Cross-Cutting Nonfunctional Contracts

This document establishes enforceable nonfunctional baselines across security, performance, accessibility, observability, and concurrency. Every feature spec must check against these criteria.

---

## 1. Security Baseline

- **Input Sanitization & Validation**:
  - All incoming HTTP payloads must pass through NestJS `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
  - Malformed types, unexpected keys, and out-of-range numbers must be rejected before touching service logic.
  - Chat messages and request text must be escaped/sanitized to prevent XSS injection.
- **Authentication & Secret Management**:
  - Passwords must be hashed using `bcrypt` with a minimum cost factor of 10.
  - JWT secret key must be loaded strictly from environment variables (`JWT_SECRET`). Hardcoding fallback secrets in code is forbidden.
  - Socket.IO handshakes must reject missing or expired tokens during connection negotiation.
- **Authorization & Ownership Enforcement**:
  - Never trust `userId`, `role`, or `amount` in client request bodies.
  - Mutations on requests, offers, or chat rooms must verify database ownership against `req.user.id`.
- **Rate Limiting**:
  - Sensitive endpoints (`POST /auth/login`, `POST /auth/register`) must enforce rate limits (maximum 10 requests per minute per IP via Redis sliding window).
- **Stripe Webhook Verification**:
  - Webhooks must reject requests with invalid or missing `stripe-signature` headers via `stripe.webhooks.constructEvent`.
  - Never store raw credit card numbers or sensitive PCI data.

---

## 2. Performance Budgets

- **API Response Latencies**:
  - Cached/in-memory endpoints (e.g. auth check, presence): `< 50ms` (p95).
  - Standard database queries (paginated requests/offers): `< 150ms` (p95).
  - Mutex-guarded operations (offer acceptance with Redis lock): `< 300ms` (p95).
- **Pagination Defaults**:
  - Default page size: `20` records.
  - Maximum allowable page size: `50` records.
  - Unbounded database queries (`find()` without limit) are strictly banned.
- **Query Optimization & N+1 Prevention**:
  - Relationships must be queried with populated references in single batch operations or lean indexed projections (`.lean()`).
  - Compound indexes must cover `service_requests (status, customerId)` and `offers (requestId, status)`.

---

## 3. Concurrency & Distributed State Contract

- **Mutual Exclusion on Acceptance**:
  - Acquisition of Redis key `mkt:lock:request:<requestId>` with a 10-second TTL.
  - Release of lock must use an atomic Lua script verifying that the releasing worker holds the lock token.
  - Secondary safety: MongoDB atomic conditional update `findOneAndUpdate({ _id: requestId, status: 'OPEN' }, { $set: { status: 'ACCEPTED', acceptedOfferId: offerId } })`.
- **Stripe Webhook Idempotency**:
  - Insert event ID into `processed_events` using unique primary key.
  - Duplicate events must immediately return HTTP `200 OK` without triggering state mutations.

---

## 4. Accessibility (a11y) Baseline

- **Standard**: WCAG 2.1 Level AA.
- **Keyboard Navigation**:
  - All form controls, modal triggers, and buttons must be navigable via Tab/Shift+Tab and executable with Enter/Space.
- **Focus Management**:
  - Opening a modal (e.g. Offer Submission, Payment Modal) must trap keyboard focus within the dialog; Esc key must close the dialog.
- **Screen Reader Support**:
  - All interactive elements must have clear text or `aria-label` / `aria-labelledby`.
  - Real-time notifications and toast alerts must use `role="status"` or `aria-live="polite"`.

---

## 5. Observability & Logging Baseline

- **Structured Logging**:
  - Use NestJS built-in logger formatted with timestamp, log level (`INFO`, `WARN`, `ERROR`), context tag, and correlation IDs where applicable.
  - Never log raw passwords, authorization tokens, or Stripe API keys.
- **Error Tracking**:
  - HTTP 500 errors must include internal stack traces in server logs but return sanitized, user-safe messages in client responses.
