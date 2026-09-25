# Feature Test Reports

This directory contains individual, end-to-end SQA test reports for every feature implemented in the project.

## Quality Assurance Policy

1. **One Report Per Feature:** Every feature defined in `context/feature-specs/` must have a corresponding test report file here (e.g. `FEAT-001-test-report.md`).
2. **100% Pass Rate Required:** A feature is considered incomplete until all automated tests (Frontend fake DOM, Backend, API, Database) pass 100%.
3. **Fail-Fast / Stop-the-Line Rule:** If any test fails, it must be resolved before proceeding to the next feature spec.
4. **Template:** Use [`template-test-report.md`](./template-test-report.md) when generating a new feature test report.

## Directory Structure

```
feature-test-reports/
├── README.md                     ← Guidelines and instructions
├── template-test-report.md       ← Master template for new test reports
├── FEAT-001-test-report.md       ← Feature 001 SQA test report
├── FEAT-002-test-report.md       ← Feature 002 SQA test report
└── ...
```
