# Issues Index — Real-Time Service Marketplace (FlogenAI)

This index summarizes all findings identified during the QA audit executed from [`QA-Testing-Final.md`](./QA-Testing-Final.md). Issues are grouped by severity with high-impact items prioritized.

---

## Executive Summary

| Total Issues | Critical | High | Medium | Low | Open | Verified Fixed |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **7** | **0** | **2** | **3** | **2** | **3** | **4** |

- **Critical Invariants Verified Safe:**
  - Distributed Concurrency: 10 parallel acceptance race conditions verified with 0 double-acceptances (Tier 1 Redis mutex + Tier 2 MongoDB atomic mutation).
  - Stripe Webhooks: Cryptographic HMAC-SHA256 signatures and idempotency (`processed_events`) verified with 0 duplicate transactions on replay.
  - Chat Privacy: Server-side room authorization on `conversation:join` strictly isolates chat to customer and winning provider; foreign sockets rejected.
  - Cross-Instance Scaling: Socket.IO events synchronized across dual NestJS instances via Redis Pub/Sub adapter.

---

## Issues Grouped by Severity

### High Severity (2 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-001** | Whitespace-Only Request Title or Description Triggers HTTP 500 Error | Forms / Error Handling | `POST /api/requests` | Verified Fixed | [`ISSUE-001-request-whitespace-input-500-error.md`](./ISSUE-001-request-whitespace-input-500-error.md) |
| **ISSUE-002** | Whitespace-Only Offer Proposal Message Triggers HTTP 500 Error | Forms / Error Handling | `POST /api/requests/:id/offers` | Verified Fixed | [`ISSUE-002-offer-whitespace-message-500-error.md`](./ISSUE-002-offer-whitespace-message-500-error.md) |

---

### Medium Severity (3 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-003** | Missing Strict Rate Limiting Throttle on User Registration Endpoint | Security / Rate Limiting | `POST /api/auth/register` | Verified Fixed | [`ISSUE-003-missing-rate-limit-auth-register.md`](./ISSUE-003-missing-rate-limit-auth-register.md) |
| **ISSUE-004** | Navigation Bar Hides Dashboard Links on Mobile Viewports Without Mobile Menu | Navigation / Usability | `NavigationBar` (< 640px) | Verified Fixed | [`ISSUE-004-mobile-navigation-links-hidden.md`](./ISSUE-004-mobile-navigation-links-hidden.md) |
| **ISSUE-005** | Absence of Client-Side Route Protection and Role Redirect on Dashboard Routes | Auth / Navigation | `/customer/requests`, `/provider/browse` | Open | [`ISSUE-005-missing-client-route-protection.md`](./ISSUE-005-missing-client-route-protection.md) |

---

### Low Severity (2 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-006** | Discrepancy Between Frontend and Backend Minimum Budget Threshold | Forms / Consistency | `CreateRequestForm` vs `CreateRequestDto` | Open | [`ISSUE-006-fractional-budget-validation-discrepancy.md`](./ISSUE-006-fractional-budget-validation-discrepancy.md) |
| **ISSUE-007** | Silent Session Eviction Without User Notification on Expired JWT | Auth / Usability | `AuthProvider` (`initializeAuth`) | Open | [`ISSUE-007-silent-expired-session-eviction.md`](./ISSUE-007-silent-expired-session-eviction.md) |

---

## Recommended Action Plan

1. **Immediate (Sprint 1):**
   - Fix **ISSUE-001** and **ISSUE-002**: Add `@Transform` trim decorators in `CreateRequestDto` and `CreateOfferDto` and map Mongoose validation errors to HTTP 400 in `HttpExceptionFilter`.
   - Fix **ISSUE-003**: Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })` to `POST /api/auth/register` in `AuthController`.
2. **Next (Sprint 2):**
   - Fix **ISSUE-004**: Add responsive mobile hamburger menu toggle to `NavigationBar`.
   - Fix **ISSUE-005**: Add client-side authentication and role check to `/customer/requests` and `/provider/browse`.
3. **Polish (Sprint 3):**
   - Fix **ISSUE-006**: Align budget threshold copy and validation between client and backend.
   - Fix **ISSUE-007**: Add non-intrusive toast or redirect notification when expired sessions are evicted.
