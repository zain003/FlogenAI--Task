# EPIC-001-VERIFY — Full Marketplace Lifecycle & Concurrency Journey (P0)

**Layer**: Epic Verification  
**Constituent features**: `FEAT-001`, `FEAT-002`, `FEAT-003`, `FEAT-004`, `FEAT-005`, `FEAT-006`  
(All constituent features must show `VERIFY: passed` in `INDEX.md` before this epic verification runs)

---

## 1. Journey Being Tested

The complete end-to-end lifecycle of a real-time service marketplace transaction across distributed backend nodes:
1. **Customer & Provider Setup**: Customer registers and authenticates; Provider 1 and Provider 2 register and authenticate.
2. **Request Publication**: Customer creates a Service Request ("Renovate Bathroom", Budget: $500). Provider 1 and Provider 2 receive real-time notification on their respective instances.
3. **Competing Offers**: Provider 1 submits an offer of $450; Provider 2 submits an offer of $480. Customer receives both offers in real time.
4. **Concurrent Acceptance Attack**: Two simultaneous acceptance requests (one for Provider 1's offer, one for Provider 2's offer) hit different backend instances at the exact same millisecond. The concurrency engine accepts strictly ONE offer and rejects the second with HTTP 409 Conflict.
5. **Stripe Test Payment**: Customer triggers payment for the accepted offer ($450). Stripe PaymentIntent is generated on the backend. Customer enters test payment credentials. Stripe webhook confirms payment, transition request to `PAID`.
6. **Authorized Chat**: Customer and the winning Provider enter their private chat room and exchange messages in real time. Provider 2 attempts to eavesdrop and is rejected with an authorization error.

---

## 2. End-to-End Tests to Run FIRST

```bash
npm run test:e2e -- marketplace-journey.e2e-spec.ts
```

1. `should complete full registration and login flow for customer and 2 providers`
2. `should broadcast created request to both connected providers`
3. `should allow both providers to submit competing offers`
4. `RACE TEST: should fire 2 simultaneous acceptance requests across Node 1 and Node 2; exactly 1 succeeds and 1 fails with HTTP 409`
5. `should process Stripe payment and transition request status to PAID via idempotent webhook`
6. `should allow customer and winning provider to chat in real time across different NestJS nodes`
7. `SECURITY TEST: should reject losing provider from reading or sending messages in the chat room`

---

## 3. Cross-Feature Acceptance Criteria

- [x] AC-1 (Auth -> Requests): JWT tokens issued by Auth module correctly authenticate Request creation and retrieval.
- [x] AC-2 (Requests -> Offers): Offers strictly reference existing `OPEN` requests.
- [x] AC-3 (Concurrency Seam): Concurrency guard guarantees that only 1 offer is accepted, with zero orphaned Redis locks and zero database inconsistencies.
- [x] AC-4 (Offers -> Payments): Payment amount is determined strictly from the accepted offer price ($450) and cannot be modified by the client.
- [x] AC-5 (Payments -> Webhook -> Chat): Webhook confirms payment, unlocks chat room, and emits real-time event.
- [x] AC-6 (Chat Privacy): Only authorized counterparties can join `conversation:<id>`; third-party access returns server-side error.
- [x] AC-7 (Multi-Instance Delivery): Every real-time event functions seamlessly between clients connected to different NestJS nodes.

---

## 4. Edge Cases Across Seams

- **Payment Failure Mid-Journey**: If customer card is declined, request status remains `ACCEPTED` and offer remains `ACCEPTED`, allowing customer to retry payment without restarting the offer flow.
- **Provider Disconnect During Acceptance**: If provider is offline when offer is accepted, the event is queued/recorded in MongoDB; upon reconnection, provider receives the updated accepted state.
- **Replay Webhook Attack**: Replaying the Stripe webhook after the chat has started has zero impact on the chat or payment state.

---

## 5. SQA Test Report Generation Mandate

- [x] Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/EPIC-001-test-report.md`.
- [x] Record all end-to-end journey steps, race condition verification results, cross-node socket delivery logs, and final verdict: `APPROVED (PASSED 100%)`.
- [x] Update `context/feature-specs/INDEX.md` and `context/progress-tracker.md` to mark the entire project pipeline ready for launch.

## Stop-The-Line Rule
If ANY step of the journey fails: do NOT mark the epic complete. Identify the owning feature spec, resolve the defect, and re-run the entire end-to-end journey until 100% pass rate is achieved.
