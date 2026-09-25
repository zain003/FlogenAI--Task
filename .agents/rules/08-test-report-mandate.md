# Rule: Test Report Mandate

Every feature implemented in this workspace must produce a formal SQA test report:

- **Template Location**: `feature-test-reports/template-test-report.md`.
- **Target File**: `feature-test-reports/FEAT-XXX-test-report.md` (or `EPIC-XXX-test-report.md`).
- **Timing**: Must be generated immediately following the feature's verification step (`FEAT-XXX-VERIFY`).
- **Contents Required**:
  1. Executive Summary table with total test cases, pass/fail count, 100% pass rate.
  2. Test environment details.
  3. Acceptance Criteria Traceability Matrix mapping every AC to automated test name.
  4. Multi-layer test execution logs (Frontend Fake DOM, API, Backend, DB/Concurrency).
  5. Edge cases and boundary analysis (especially race conditions and replay attacks).
  6. Final SQA Verdict: `APPROVED (PASSED 100%)`.
- **Enforcement**: No feature is marked complete in `INDEX.md` or `progress-tracker.md` without this report committed.
