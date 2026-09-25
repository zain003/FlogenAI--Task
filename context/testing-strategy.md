# SQA Testing Strategy & Quality Standards — Real-Time Service Marketplace

## Role & Philosophy

You are a Senior SQA Automation & Test Engineer. Your objective is 100% end-to-end quality confidence for every feature before it is marked complete. No code moves forward with failing tests. Every layer—Frontend (Fake DOM / jsdom), Backend logic, API routes, and Database/Concurrency—must be rigorously verified against functional and edge-case requirements.

---

## Multi-Layer Testing Architecture

Every feature specified in `context/feature-specs/` must be tested across the following 4 layers:

```
+-------------------------------------------------------------------------+
|                         FULL-STACK SQA MATRIX                          |
+-------------------------------------------------------------------------+
|  1. FRONTEND LAYER    | Fake DOM / jsdom (Vitest + React Testing Lib)   |
|                       | Components, UI states, user interactions, a11y  |
+-----------------------+-------------------------------------------------+
|  2. API LAYER         | Supertest + NestJS TestModule                   |
|                       | Route handlers, HTTP status, request validation,|
|                       | response schemas, auth headers, error shapes    |
+-----------------------+-------------------------------------------------+
|  3. BACKEND LAYER     | Unit tests (Jest / Vitest)                      |
|                       | Business rules, validation logic, permission    |
|                       | enforcement, service functions, data transforms |
+-----------------------+-------------------------------------------------+
|  4. DATABASE & LOCKS  | MongoMemoryServer + Redis Client / Test DB      |
|                       | Schema constraints, CRUD ops, atomic updates,   |
|                       | distributed locks, race conditions, rollbacks   |
+-------------------------------------------------------------------------+
```

---

## Mandatory Test Suites per Assessment Scope

The following test suites are non-negotiable requirements from `Project-scope.md`:

### 1. Unauthorized API Access
- Accessing protected endpoints without an `Authorization` header returns HTTP `401 Unauthorized`.
- Accessing role-restricted endpoints with an invalid role (e.g., Provider attempting to accept an offer, Customer attempting to submit an offer) returns HTTP `403 Forbidden`.
- Accessing or modifying a resource belonging to another customer returns HTTP `403 Forbidden`.

### 2. Offer Acceptance Logic
- A customer accepts an open offer on their service request.
- The request status transitions from `OPEN` to `ACCEPTED`.
- The offer status transitions from `PENDING` to `ACCEPTED`.
- All other offers on the same request transition to `REJECTED`.
- A payment record is created with status `PENDING` and the exact offer amount.

### 3. Concurrent / Double-Acceptance Protection (Race Condition Suite)
- **Scenario**: Two parallel asynchronous acceptance requests hit the backend at the exact same millisecond for the same service request (simulating two requests hitting NestJS Node 1 and Node 2 simultaneously).
- **Assertion**:
  - Exactly ONE request succeeds with HTTP `200 OK`.
  - The second request is rejected with HTTP `409 Conflict` (or `400 Bad Request`).
  - The database records exactly ONE accepted offer.
  - Zero partial updates, zero duplicated payments, zero orphaned locks.

### 4. Stripe Webhook Signature Verification & Idempotency
- Incoming webhook with invalid signature is rejected with HTTP `400 Bad Request`.
- Incoming valid `payment_intent.succeeded` transitions payment to `SUCCEEDED` and request to `PAID`.
- **Idempotency Replay Test**: Sending the exact same Stripe event payload 3 times consecutively returns HTTP `200 OK` on all calls, but the database state is modified only on the first call, and no duplicate records are generated.

### 5. Socket.IO Gateway Authentication & Authorization
- Connecting without a valid JWT token fails connection handshake.
- Connected client attempting to emit `conversation:join` for an unauthorized conversation is rejected with an error event.
- Real-time events (`request:created`, `offer:created`, `offer:accepted`, `message:new`) properly dispatch to the intended target room.

---

## Layer-by-Layer SQA Standards

### 1. Frontend Testing (Fake DOM & UI Interaction)
- **Framework & Runtime**: Next.js 16 (App Router, React 19) components tested via simulated DOM (`jsdom`) using Vitest and `@testing-library/react`.
- **Component Rendering**: Verify default, loading, empty, error, and populated states.
- **User Interactions**: Simulate clicks, typing, keyboard navigation, form submission, and focus management using `@testing-library/user-event`.
- **Fake DOM Mocking**:
  - Mock browser APIs (`matchMedia`, `ResizeObserver`, `localStorage`).
  - Mock network requests at the transport level (MSW or vi.fn mocks).

### 2. API Contract & Endpoint Testing
- **Contract Verification**: Every endpoint must match the schemas defined in `000-shared-contracts.md`.
- **Status Codes**: `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`.
- **Payload & Response Shapes**: Verify exact JSON shape, required vs. optional fields, headers, and error payload structures.

### 3. Backend & Business Logic Testing
- **Unit Isolation**: Pure service functions and calculation logic tested with zero external dependencies.
- **Validation Engine**: Test every validation schema against valid data, edge cases, and invalid inputs.
- **Error Handling**: Verify every exception branch throws the expected error type.

### 4. Database & Storage Testing
- **Schema & Constraints**: Verify unique email constraint, compound indexes, and relational integrity.
- **Atomic Operations**: Verify atomic updates roll back cleanly when an error occurs mid-operation.

---

## 100% Feature Test & Verification Rule

For every feature (`FEAT-001`, `FEAT-002`, `FEAT-003`, etc.):

1. **Tests Written First / In-Tandem**: Test cases are defined before or alongside implementation, directly mapped to the feature's acceptance criteria.
2. **Zero Tolerance Quality Gate ("Stop the Line")**:
   - If ANY test fails during implementation or verification, STOP immediately.
   - Do NOT proceed to the next feature until all tests pass 100%.
   - Fix the root cause in code or spec; never comment out or disable a failing test.

---

## Mandatory Feature Test Reports (`feature-test-reports/`)

Every feature must have a dedicated test report created in `feature-test-reports/` at the project root upon implementation completion.

### Naming Convention
```
feature-test-reports/
  ├── FEAT-001-test-report.md
  ├── FEAT-002-test-report.md
  ├── FEAT-003-test-report.md
  ├── FEAT-004-test-report.md
  ├── FEAT-005-test-report.md
  ├── FEAT-006-test-report.md
  └── EPIC-001-test-report.md
```

### Template Usage Requirement
The test report MUST be created by copying and completing [`feature-test-reports/template-test-report.md`](../feature-test-reports/template-test-report.md):
1. **Feature Metadata**: Feature ID, Name, Target Layer, Date, Tester.
2. **Test Environment & Stack**: Frameworks, DOM simulator, test runner version.
3. **Traceability Matrix**: Each Acceptance Criterion mapped directly to its automated test name and file location.
4. **Execution Results**: Pass/Fail logs across all 4 layers.
5. **Edge Cases & Boundary Analysis**: Concurrency, replay attacks, boundary values.
6. **Defects Found & Resolved**: Root cause and resolution.
7. **Final SQA Verdict**: **PASSED (100%)** or **BLOCKED**.

---

## SQA Definition of Done (DoD) Checklist

Before any feature is approved:
- [ ] All Frontend / Fake DOM component tests pass (`vitest`).
- [ ] All Backend and API contract tests pass (`npm run test:api` / `npm run test:unit`).
- [ ] All Database transactions and concurrency/race condition tests pass.
- [ ] 100% of Acceptance Criteria from the feature spec are verified by automated tests.
- [ ] Zero failing tests, zero skipped tests, zero console errors/warnings during test run.
- [ ] Test report is written and saved to `feature-test-reports/FEAT-XXX-test-report.md` using `feature-test-reports/template-test-report.md`.
- [ ] `context/progress-tracker.md` and `context/feature-specs/INDEX.md` are updated.
