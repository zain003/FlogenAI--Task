# FEAT-003-VERIFY — Offers & Concurrency Verification Pass

**Layer**: Verification  
**Files being verified**: `FEAT-003-BE-offers.md`, `FEAT-003-FE-offers.md`, `FEAT-003-INT-offers-realtime.md`

## 1. Test Execution Verification

Execute all test suites from `FEAT-003-BE`, `FEAT-003-FE`, and `FEAT-003-INT`:
- [ ] Run Backend API & Concurrency tests: `npm run test:api -- offers.controller.spec.ts concurrency.spec.ts`
  - `should allow authenticated provider to submit offer on open request`
  - `should reject offer submission on closed or accepted request with HTTP 400`
  - `should allow customer who owns request to accept an offer with HTTP 200`
  - `should reject offer acceptance by a user who does not own the request with HTTP 403`
  - `CONCURRENCY RACE TEST: should reject simultaneous double-acceptance attempts with HTTP 409 and accept exactly ONE offer`
  - `should mark unaccepted offers as REJECTED upon successful acceptance`
- [ ] Run Frontend Fake DOM tests: `npm run test:ui -- offers.spec.tsx`
  - `should render submit offer button only for provider users`
  - `should validate offer price is greater than 0 before submission`
  - `should render list of offers with price, provider name, and message`
  - `should trigger accept offer mutation when customer clicks accept`
  - `should disable accept buttons on all offers once one offer is accepted`
- [ ] Run Real-Time Integration tests: `npm run test:int -- socket.offers.spec.ts`
  - `should emit offer:created to customer personal room when offer is posted`
  - `should emit offer:accepted to selected provider room when offer is accepted`
  - `should broadcast request:closed to providers room when offer is accepted`
  - `should propagate offer events across two NestJS instances via Redis adapter`

## 2. Acceptance Criteria Verification Matrix

- [ ] AC-1: Provider can submit an offer with price and proposal message.
- [ ] AC-2: Customer can view offers and accept a specific offer.
- [ ] AC-3: Double-acceptance race condition fails: 10 parallel acceptance calls result in exactly 1 success and 9 conflicts.
- [ ] AC-4: State of winning offer is `ACCEPTED`; remaining offers on request are `REJECTED`.
- [ ] AC-5: Real-time alerts reach customer and providers across cluster.

## 3. Concurrency & Security Audit

- [ ] Redis lock is released via Lua script verifying token ownership (no orphaned keys).
- [ ] Secondary defense: MongoDB conditional update enforces atomic status check.

## 4. SQA Test Report Generation Mandate

- [ ] Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/FEAT-003-test-report.md`.
- [ ] Record test logs, race condition test output, pass rates, and final verdict: `APPROVED (PASSED 100%)`.
- [ ] Update `context/feature-specs/INDEX.md` and `context/progress-tracker.md`.

## Stop-The-Line Rule
If ANY test fails or if a race condition allows 2 acceptances: do NOT mark complete. Fix immediately and re-run until 100% pass.
