# Issues Index — Real-Time Service Marketplace (FlogenAI)

This index summarizes all findings identified during the QA audit executed from [`QA-Testing-Final.md`](./QA-Testing-Final.md). Issues are grouped by severity with high-impact items prioritized.

---

## Executive Summary

| Total Issues | Critical | High | Medium | Low | Open | Verified Fixed |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **10** | **0** | **3** | **4** | **3** | **0** | **10** |

- **Critical Invariants Verified Safe:**
  - **Distributed Concurrency:** 10 parallel acceptance race conditions verified with 0 double-acceptances (Tier 1 Redis mutex + Tier 2 MongoDB atomic mutation).
  - **Stripe Webhooks:** Cryptographic HMAC-SHA256 signatures and idempotency (`processed_events`) verified with 0 duplicate transactions on replay.
  - **Chat Privacy:** Server-side room authorization on `conversation:join` strictly isolates chat to customer and winning provider; foreign sockets rejected with error.
  - **Cross-Instance Scaling:** Socket.IO events synchronized across dual NestJS instances via Redis Pub/Sub adapter.

---

## Issues Grouped by Severity

### High Severity (3 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-001** | Whitespace-Only Request Title or Description Triggers HTTP 500 Error | Forms / Error Handling | `POST /api/requests` | Verified Fixed | [`ISSUE-001-request-whitespace-input-500-error.md`](./ISSUE-001-request-whitespace-input-500-error.md) |
| **ISSUE-002** | Whitespace-Only Offer Proposal Message Triggers HTTP 500 Error | Forms / Error Handling | `POST /api/requests/:id/offers` | Verified Fixed | [`ISSUE-002-offer-whitespace-message-500-error.md`](./ISSUE-002-offer-whitespace-message-500-error.md) |
| **ISSUE-008** | Real-Time Chat Message Broadcast Bypassed by Client HTTP POST in ChatWindow | Real-Time / Socket.IO | `ChatWindow` vs `ChatGateway` | Verified Fixed | [`ISSUE-008-realtime-chat-broadcast-bypassed-by-http.md`](./ISSUE-008-realtime-chat-broadcast-bypassed-by-http.md) |

---

### Medium Severity (4 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-003** | Missing Strict Rate Limiting Throttle on User Registration Endpoint | Security / Rate Limiting | `POST /api/auth/register` | Verified Fixed | [`ISSUE-003-missing-rate-limit-auth-register.md`](./ISSUE-003-missing-rate-limit-auth-register.md) |
| **ISSUE-004** | Navigation Bar Hides Dashboard Links on Mobile Viewports Without Mobile Menu | Navigation / Usability | `NavigationBar` (< 640px) | Verified Fixed | [`ISSUE-004-mobile-navigation-links-hidden.md`](./ISSUE-004-mobile-navigation-links-hidden.md) |
| **ISSUE-005** | Absence of Client-Side Route Protection and Role Redirect on Dashboard Routes | Auth / Navigation | `/customer/requests`, `/provider/browse` | Verified Fixed | [`ISSUE-005-missing-client-route-protection.md`](./ISSUE-005-missing-client-route-protection.md) |
| **ISSUE-010** | Inconsistent WebSocket Environment Variable Resolution in Socket Context | Infrastructure / Real-Time | `SocketProvider` (`socket-context.tsx`) | Verified Fixed | [`ISSUE-010-inconsistent-socket-url-env-resolution.md`](./ISSUE-010-inconsistent-socket-url-env-resolution.md) |

---

### Low Severity (3 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-006** | Discrepancy Between Frontend and Backend Minimum Budget Threshold | Forms / Consistency | `CreateRequestForm` vs `CreateRequestDto` | Verified Fixed | [`ISSUE-006-fractional-budget-validation-discrepancy.md`](./ISSUE-006-fractional-budget-validation-discrepancy.md) |
| **ISSUE-007** | Silent Session Eviction Without User Notification on Expired JWT | Auth / Usability | `AuthProvider` (`initializeAuth`) | Verified Fixed | [`ISSUE-007-silent-expired-session-eviction.md`](./ISSUE-007-silent-expired-session-eviction.md) |
| **ISSUE-009** | Discrepancy Between Offer Submission Modal and Backend Minimum Price Threshold | Forms / Consistency | `SubmitOfferDialog` vs `CreateOfferDto` | Verified Fixed | [`ISSUE-009-fractional-offer-price-validation-discrepancy.md`](./ISSUE-009-fractional-offer-price-validation-discrepancy.md) |

---

## Remediation Summary

All 10 identified issues across High, Medium, and Low severity classifications have been resolved, comprehensively tested, and verified:
1. **ISSUE-008 (Verified Fixed):** Injected `ChatGateway` in `ChatController` to broadcast `message:new` over Redis Pub/Sub adapter to all connected conversation peers upon HTTP message creation.
2. **ISSUE-009 (Verified Fixed):** Aligned `SubmitOfferDialog` with backend `@Min(1)` constraint (`parsedPrice < 1`, `min="1.00"`, clear error message).
3. **ISSUE-010 (Verified Fixed):** Updated `SocketProvider` to prioritize `NEXT_PUBLIC_SOCKET_URL` per `000-infra-contracts.md` and `docker-compose.yml`, with backward-compatible fallbacks and 4 dedicated unit tests.
