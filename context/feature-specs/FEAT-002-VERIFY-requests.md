# FEAT-002-VERIFY — Service Requests Verification Pass

**Layer**: Verification  
**Files being verified**: `FEAT-002-BE-requests.md`, `FEAT-002-FE-requests.md`, `FEAT-002-INT-requests-realtime.md`

## 1. Test Execution Verification

Execute all test suites from `FEAT-002-BE`, `FEAT-002-FE`, and `FEAT-002-INT`:
- [ ] Run Backend API tests: `npm run test:api -- requests.controller.spec.ts`
  - `should allow authenticated customer to create request with HTTP 201`
  - `should reject request creation by provider with HTTP 403 Forbidden`
  - `should reject request creation with negative budget or empty title with HTTP 400`
  - `should list open requests with pagination metadata`
  - `should enforce maximum limit of 50 on request list queries`
  - `should return 404 Not Found when querying non-existent request ID`
- [ ] Run Frontend Fake DOM tests: `npm run test:ui -- requests.spec.tsx`
  - `should render create request form with title, description, budget inputs`
  - `should validate budget is a positive number before submitting`
  - `should render list of open requests with title and budget formatted as USD`
  - `should display empty state message when no requests exist`
  - `should navigate to request detail page upon clicking request card`
- [ ] Run Integration & Socket tests: `npm run test:int -- socket.requests.spec.ts`
  - `should reject socket connection when handshake token is invalid or missing`
  - `should authenticate provider socket and auto-join providers room`
  - `should broadcast request:created event to providers room when request is created`
  - `should propagate request:created across two backend instances via Redis pub/sub`

## 2. Acceptance Criteria Verification Matrix

- [ ] AC-1: Customer creates service request and receives HTTP 201 with `status: OPEN`.
- [ ] AC-2: Non-customer role receives HTTP 403 when posting request.
- [ ] AC-3: Request list enforces pagination and does not return unbounded results.
- [ ] AC-4: Connected provider receives real-time `request:created` event via Socket.IO.
- [ ] AC-5: Event successfully traverses Redis Pub/Sub adapter across multiple nodes.

## 3. Nonfunctional Requirements Audit

- [ ] Latency check: Request creation and broadcast completes in `< 200ms`.
- [ ] Data integrity: Compound index `(status, customerId)` exists and is utilized by MongoDB query plan.

## 4. SQA Test Report Generation Mandate

- [ ] Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/FEAT-002-test-report.md`.
- [ ] Record test logs, pass rates, boundary results, and final verdict: `APPROVED (PASSED 100%)`.
- [ ] Update `context/feature-specs/INDEX.md` and `context/progress-tracker.md`.

## Stop-The-Line Rule
If ANY test fails: do NOT mark complete. Fix the defect and re-execute all tests before proceeding.
