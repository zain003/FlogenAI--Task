# FEAT-004-VERIFY — Stripe Payments & Webhook Verification Pass

**Layer**: Verification  
**Files being verified**: `FEAT-004-BE-payments.md`, `FEAT-004-FE-payments.md`, `FEAT-004-INT-payments-webhook.md`

## 1. Test Execution Verification

Execute all test suites from `FEAT-004-BE`, `FEAT-004-FE`, and `FEAT-004-INT`:
- [ ] Run Backend API & Webhook tests: `npm run test:api -- payments.controller.spec.ts webhook.spec.ts`
  - `should reject create-intent when caller is not the customer who accepted the offer`
  - `should calculate PaymentIntent amount on backend and ignore client-supplied amount`
  - `should reject webhook call with invalid signature with HTTP 400`
  - `should update payment to SUCCEEDED and request to PAID on payment_intent.succeeded`
  - `WEBHOOK IDEMPOTENCY TEST: should handle duplicate webhook events without double-updating database`
  - `should update payment to FAILED on payment_intent.payment_failed`
- [ ] Run Frontend Fake DOM tests: `npm run test:ui -- payments.spec.tsx`
  - `should render payment modal with offer price and Stripe Elements container`
  - `should disable pay button while processing Stripe payment`
  - `should display error alert when card confirmation returns error`
  - `should display payment success confirmation when Stripe confirms payment`
- [ ] Run Integration tests: `npm run test:int -- webhook.reconciliation.spec.ts`
  - `should process payment_intent.succeeded and transition request to PAID`
  - `should record Stripe event ID in processed_events table`
  - `should emit payment:succeeded Socket.IO event to customer and provider rooms`

## 2. Acceptance Criteria Verification Matrix

- [ ] AC-1: Backend computes PaymentIntent amount strictly from accepted offer price.
- [ ] AC-2: Webhook signature is validated using `stripe.webhooks.constructEvent`.
- [ ] AC-3: Idempotency is verified: 3 identical webhook calls result in 1 state update and 3 HTTP 200 responses.
- [ ] AC-4: Frontend handles successful Stripe test payments and transitions UI to Paid state.
- [ ] AC-5: Real-time event `payment:succeeded` is dispatched to counterparty rooms.

## 3. Security & PCI Audit

- [ ] Zero storage of cardholder numbers, expiration dates, or CVV codes.
- [ ] Raw request body buffer is used for signature validation.

## 4. SQA Test Report Generation Mandate

- [ ] Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/FEAT-004-test-report.md`.
- [ ] Populate test logs, idempotency verification logs, and verdict: `APPROVED (PASSED 100%)`.
- [ ] Update `context/feature-specs/INDEX.md` and `context/progress-tracker.md`.

## Stop-The-Line Rule
If ANY test fails or if a duplicate webhook causes duplicate transactions: do NOT mark complete. Fix the defect and re-execute.
