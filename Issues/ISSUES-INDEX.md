# Issues Index — Real-Time Service Marketplace (FlogenAI)

This index summarizes all findings identified during the QA audit executed from [`QA-Testing-Final.md`](./QA-Testing-Final.md). Issues are grouped by severity with high-impact items prioritized.

---

## Executive Summary

| Total Issues | Critical | High | Medium | Low | Open | Verified Fixed |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **10** | **0** | **3** | **4** | **3** | **1** | **9** |

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
| **ISSUE-010** | Inconsistent WebSocket Environment Variable Resolution in Socket Context | Infrastructure / Real-Time | `SocketProvider` (`socket-context.tsx`) | **Open** | [`ISSUE-010-inconsistent-socket-url-env-resolution.md`](./ISSUE-010-inconsistent-socket-url-env-resolution.md) |

---

### Low Severity (3 Issues)

| Issue ID | Title | Category | Flow / Location | Status | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-006** | Discrepancy Between Frontend and Backend Minimum Budget Threshold | Forms / Consistency | `CreateRequestForm` vs `CreateRequestDto` | Verified Fixed | [`ISSUE-006-fractional-budget-validation-discrepancy.md`](./ISSUE-006-fractional-budget-validation-discrepancy.md) |
| **ISSUE-007** | Silent Session Eviction Without User Notification on Expired JWT | Auth / Usability | `AuthProvider` (`initializeAuth`) | Verified Fixed | [`ISSUE-007-silent-expired-session-eviction.md`](./ISSUE-007-silent-expired-session-eviction.md) |
| **ISSUE-009** | Discrepancy Between Offer Submission Modal and Backend Minimum Price Threshold | Forms / Consistency | `SubmitOfferDialog` vs `CreateOfferDto` | Verified Fixed | [`ISSUE-009-fractional-offer-price-validation-discrepancy.md`](./ISSUE-009-fractional-offer-price-validation-discrepancy.md) |

---

## Recommended Action Plan for Newly Identified Issues

1. **Sprint Focus 1 (High Priority):**
   - **Fix ISSUE-008:** Update `ChatWindow.handleSendMessage` in `apps/frontend/src/components/chat/chat-window.tsx` to transmit outgoing chat messages using `socket.emit('message:send', { conversationId, content })` when connected, or trigger `chatGateway.server.to(room).emit('message:new')` from `POST /api/conversations/:id/messages`. This restores real-time bidirectional delivery without page reload.
2. **Sprint Focus 2 (Medium Priority):**
   - **Fix ISSUE-010:** Update `apps/frontend/src/context/socket-context.tsx` to inspect `process.env.NEXT_PUBLIC_SOCKET_URL` before falling back to `process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080'`. This ensures multi-instance Docker traffic passes through the Nginx reverse proxy.
3. **Sprint Focus 3 (Low Priority):**
   - **Fix ISSUE-009:** Update `SubmitOfferDialog` in `apps/frontend/src/components/offers/submit-offer-dialog.tsx` to validate `parsedPrice < 1` displaying `'Please enter a valid price of at least $1.00'` and add `min="1.00"` to the input element, mirroring `ISSUE-006`.
