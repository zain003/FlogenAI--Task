# Rule: Testing Strategy & SQA Standards

Every prompt execution and implementation task must satisfy the multi-layer testing matrix:

1. **Frontend**: Fake DOM / jsdom component and form validation tests with Vitest & React Testing Library.
2. **API**: Contract and status tests with NestJS TestModule and Supertest.
3. **Backend Logic**: Service-level business rules, permissions, and locking logic.
4. **Database & Concurrency**:
   - Offer acceptance double-accept race condition simulation (concurrent parallel calls).
   - Stripe webhook idempotency replay assertion (repeating same event payload 3x).
5. **Mandatory Test Reports**: After every feature implementation, populate `feature-test-reports/template-test-report.md` into `feature-test-reports/FEAT-XXX-test-report.md`.
6. **Zero Tolerance**: 100% test pass rate required. No feature may be marked done with failing or skipped tests.
- Source of truth: `context/testing-strategy.md`.
