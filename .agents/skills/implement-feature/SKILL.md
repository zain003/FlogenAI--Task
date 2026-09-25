---
name: implement-feature
description: >-
  Use this skill when implementing any feature unit (BE, FE, INT, or VERIFY) in the Real-Time Service Marketplace (FlogenAI) following the spec-driven workflow from plan.md, context files, and 4-layer multi-layer SQA testing.
---

# Feature Implementation Runbook (FlogenAI)

This skill provides step-by-step instructions for implementing features incrementally in the Real-Time Service Marketplace without drifting from contracts or breaking existing code.

## Pre-Implementation Checklist

1. **Read Context Files**:
   - `context/feature-specs/000-shared-contracts.md` (data models, DTOs, events)
   - `context/feature-specs/000-nonfunctional-contracts.md` (security, performance budgets)
   - `context/feature-specs/INDEX.md` (check feature status and dependencies)
2. **Pre-flight Dependency Check**:
   - Check the `Depends on` section of your target feature file (e.g. `FEAT-002-BE-requests.md`).
   - Confirm that the dependency's `VERIFY` file is marked `☑ Passed` in `INDEX.md`. If not, do NOT proceed—implement or verify the upstream dependency first.

## Implementation Steps

### Layer 1: Backend (`FEAT-XXX-BE`)
1. **Define Schema & Interfaces**:
   - Create Mongoose schema in `apps/backend/src/modules/<feature>/schemas/` with required indexes.
   - Define DTOs using `class-validator` and `class-transformer`.
2. **Write Tests First**:
   - Author API route tests in `apps/backend/src/modules/<feature>/<feature>.controller.spec.ts`.
   - Author domain logic unit tests in `apps/backend/src/modules/<feature>/<feature>.service.spec.ts`.
3. **Implement Service & Controller**:
   - Implement business logic, ownership checks, and status state machine in the service.
   - Bind HTTP routes with `@UseGuards(JwtAuthGuard, RolesGuard)` in the controller.
4. **Execute Tests**:
   - Run `npm run test:api` and `npm run test:unit`. Ensure 100% pass rate.

### Layer 2: Frontend (`FEAT-XXX-FE`)
1. **Build Components**:
   - Implement components in `apps/frontend/src/components/<feature>/` following `context/ui-context.md` (dark theme tokens, responsive layouts, accessible forms).
2. **Wire State & API**:
   - Connect forms and views to backend endpoints via `api-client.ts` using JWT auth.
3. **Write Fake DOM Tests**:
   - Author Vitest + React Testing Library tests in `apps/frontend/src/tests/<feature>.spec.tsx`.
   - Test default, loading, error, and populated states.
4. **Execute Tests**:
   - Run `npm run test:ui`. Ensure 100% pass rate.

### Layer 3: Integration (`FEAT-XXX-INT`)
1. **Configure Socket or Webhook Gateways**:
   - For real-time features: connect Gateway to Socket.IO Redis Adapter, join authorized rooms, and emit typed events.
   - For webhooks: verify raw body signature and record event ID for idempotency.
2. **Author Integration Tests**:
   - Test event propagation, multi-node broadcasting, or webhook replay.

### Layer 4: Verification & SQA Sign-Off (`FEAT-XXX-VERIFY`)
1. Re-run all test suites across all 4 layers (Fake DOM, API, Backend, DB/Concurrency).
2. Confirm zero failing tests, zero skipped tests, and zero linter/compiler errors.
3. Generate the formal test report using the `sqa-test-reporting` skill:
   - Copy `feature-test-reports/template-test-report.md` to `feature-test-reports/FEAT-XXX-test-report.md`.
   - Fill in all 7 sections with execution logs.
4. Update `context/feature-specs/INDEX.md` status to `☑ Passed`.
5. Update `context/progress-tracker.md` with completed feature details and test report link.
