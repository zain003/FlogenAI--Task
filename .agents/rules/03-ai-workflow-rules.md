# Rule: AI Workflow & Execution Protocol

Every prompt execution and implementation task must follow this execution discipline:

- **Spec-Driven Work**: Work on one feature file at a time from `context/feature-specs/` in the build order defined in `plan.md` and `INDEX.md`.
- **Pre-Flight Check**: Confirm that all dependency features have passed verification and their test reports exist before starting a new feature.
- **Stop-The-Line Quality Rule**: Zero failing tests allowed. If any test fails, halt immediately, diagnose, and fix the root cause.
- **Mandatory SQA Test Reports**: Upon completing any feature, generate a comprehensive test report using `feature-test-reports/template-test-report.md` and save it to `feature-test-reports/FEAT-XXX-test-report.md`.
- **Track Progress**: Update `context/progress-tracker.md` and `context/feature-specs/INDEX.md` after every feature verification.
- Source of truth: `context/ai-workflow-rules.md`.
