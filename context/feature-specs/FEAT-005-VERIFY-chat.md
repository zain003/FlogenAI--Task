# FEAT-005-VERIFY — Real-Time Chat & Room Authorization Verification Pass

**Layer**: Verification  
**Files being verified**: `FEAT-005-BE-chat.md`, `FEAT-005-FE-chat.md`, `FEAT-005-INT-chat-realtime.md`

## 1. Test Execution Verification

Execute all test suites from `FEAT-005-BE`, `FEAT-005-FE`, and `FEAT-005-INT`:
- [ ] Run Backend API & Chat tests: `npm run test:api -- chat.controller.spec.ts`
  - `should create or return existing conversation for accepted request`
  - `should allow customer participant to fetch conversation messages`
  - `should allow provider participant to fetch conversation messages`
  - `should reject third-party user attempting to fetch conversation messages with HTTP 403`
  - `should paginate messages in reverse chronological order`
  - `should persist message entity in database with sender ID and timestamp`
- [ ] Run Frontend Fake DOM tests: `npm run test:ui -- chat.spec.tsx`
  - `should render chat window with message history and input box`
  - `should display own messages aligned to right and counterparty messages to left`
  - `should clear input field after sending a message`
  - `should prevent sending empty or whitespace-only messages`
  - `should auto-scroll to bottom when new message arrives`
- [ ] Run Real-Time Gateway & Room Auth tests: `npm run test:int -- socket.chat.spec.ts`
  - `SERVER AUTH TEST: should reject conversation:join when user is neither customer nor provider of conversation`
  - `should allow authorized customer and provider to join conversation room`
  - `should reject message:send from socket not authorized in conversation`
  - `should persist message to MongoDB before broadcasting message:new`
  - `should broadcast message:new across two NestJS instances via Redis adapter`

## 2. Acceptance Criteria Verification Matrix

- [ ] AC-1: Server rejects unauthorized socket room join attempts.
- [ ] AC-2: Messages are persisted in MongoDB with sender ID and conversation ID.
- [ ] AC-3: Messages sent on Node 1 reach client on Node 2 via Redis Pub/Sub adapter.
- [ ] AC-4: UI correctly updates chat history and maintains clean auto-scroll.

## 3. Privacy & Invariant Audit

- [ ] Zero leakage: No user can join arbitrary conversation rooms or inspect messages.
- [ ] Authenticated user identity attached to message strictly from server-side socket token.

## 4. SQA Test Report Generation Mandate

- [ ] Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/FEAT-005-test-report.md`.
- [ ] Document room security checks, pass rates (100%), and verdict: `APPROVED (PASSED 100%)`.
- [ ] Update `context/feature-specs/INDEX.md` and `context/progress-tracker.md`.

## Stop-The-Line Rule
If ANY test fails or room authorization allows a foreign user in: do NOT mark complete. Fix immediately and re-run.
