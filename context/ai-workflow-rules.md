# AI Workflow Rules — Real-Time Service Marketplace

## Approach

1. **Spec-Driven Incremental Implementation**: Implement features strictly one file at a time following the specifications defined in `context/feature-specs/` and structured according to `plan.md`.
2. **Read-Before-Execute Rule**: Before executing any user prompt or implementation step, read the relevant context files in `context/` and the active feature spec in `context/feature-specs/`.
3. **Mandatory SQA Test Gate**: Every feature must achieve 100% test pass rate across all applicable layers (Frontend Fake DOM, API routes, Backend business rules, Database/concurrency).
4. **Mandatory Test Report Generation**: Upon completing each feature, immediately generate a formal test report using the template provided at `feature-test-reports/template-test-report.md` and save it to `feature-test-reports/FEAT-XXX-test-report.md`. Zero skipped or failing tests allowed.

## Scoping Rules

- Work on one feature specification unit at a time (`FEAT-XXX-BE`, `FEAT-XXX-FE`, `FEAT-XXX-INT`, `FEAT-XXX-VERIFY`).
- Strictly separate Backend (`BE`), Frontend (`FE`), Integration (`INT`), and Verification (`VERIFY`) layers.
- Do not make speculative edits outside the scope defined in the active feature specification.
- Never invent business logic or data structures not declared in `000-shared-contracts.md` or the active feature spec.

## When to Split Work

Split an implementation step immediately if it involves:
- Multiple architectural layers simultaneously (e.g. attempting to wire UI forms before backend API contracts are tested and verified).
- Unrelated feature domains (e.g. mixing Stripe payments logic with Socket.IO chat messaging).
- High complexity modules exceeding 150 lines of specification.

## Concurrency & Safety Discipline

- For offer acceptance (`FEAT-003`), automated tests MUST execute parallel asynchronous requests to verify that double acceptance is physically impossible under high concurrency.
- For Stripe webhooks (`FEAT-004`), automated tests MUST replay identical webhook payloads to prove idempotency.
- Never use frontend state or client-side checks to solve server-side concurrency or pricing integrity.

## Protected Files & Conventions

Do not modify the following without explicit justification and architectural alignment:
- `docker-compose.yml` base networking and port mappings (NestJS 1: 3001, NestJS 2: 3002, Redis: 6379, MongoDB: 27017, Nginx: 80/8080).
- Core MongoDB schema fields established in `000-shared-contracts.md`.
- `feature-test-reports/template-test-report.md` (master template must remain intact).

## Keeping Documentation in Sync

Update documentation continuously:
- **`specs/DEVIATIONS.md`**: Log any minor ambiguity resolution immediately.
- **`specs/CONTRACT-CHANGELOG.md`**: Log any change to an exposed API or type signature.
- **`specs/INDEX.md`**: Update feature status (`not started`, `in progress`, `passed`).
- **`context/progress-tracker.md`**: Update current phase, completed units, and active goals after every feature.

## Feature Completion Checklist (Definition of Done)

Before declaring any feature complete and moving to the next:
1. All Acceptance Criteria from the feature spec pass 100%.
2. Multi-layer automated tests pass with zero failures and zero skipped tests.
3. Concurrency and boundary conditions tested and verified.
4. Dedicated test report is authored and saved to `feature-test-reports/FEAT-XXX-test-report.md` using `feature-test-reports/template-test-report.md`.
5. `context/feature-specs/INDEX.md` and `context/progress-tracker.md` are updated to reflect the passing status and test report path.
6. TypeScript compilation (`tsc --noEmit`), linting, and build pass with zero errors.
