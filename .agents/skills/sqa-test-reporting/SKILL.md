---
name: sqa-test-reporting
description: >-
  Use this skill to author, format, and commit formal SQA test reports using feature-test-reports/template-test-report.md upon completing verification of any feature (FEAT-001 through FEAT-006, or EPIC-001).
---

# SQA Test Reporting Runbook

This skill defines the mandatory protocol for generating formal SQA test reports after completing the implementation and verification of any feature.

## Gate Policy: 100% Pass Rate Required

- A feature is strictly **incomplete** until all automated tests pass with 0 failures and a dedicated test report is committed.
- Never mark a feature complete in `INDEX.md` or `progress-tracker.md` without the corresponding test report file existing.

## Step-by-Step Reporting Instructions

### Step 1: Copy Master Template
Copy `feature-test-reports/template-test-report.md` to:
`feature-test-reports/FEAT-XXX-test-report.md` (e.g. `feature-test-reports/FEAT-001-test-report.md`).

### Step 2: Fill Metadata & Executive Summary
- Set Feature ID, Feature Name, Spec Reference, and Current Date.
- Count total executed tests across all layers. Ensure:
  - Passed = Total
  - Failed = 0
  - Skipped = 0
  - Pass Rate = 100%
  - SQA Verdict = `PASSED`

### Step 3: Populate Acceptance Criteria Traceability Matrix
For every Acceptance Criterion listed in the feature's spec files (`BE`, `FE`, `INT`):
- Map the AC ID (`AC-1`, `AC-2`, etc.) to the exact test file path and test description.
- Set Status to `PASS`.

### Step 4: Include Execution Logs
Paste real terminal output snippets for:
1. **Frontend Layer**: `npm run test:ui -- <spec>`
2. **API Layer**: `npm run test:api -- <spec>`
3. **Backend Logic Layer**: `npm run test:unit -- <spec>`
4. **Database & Concurrency Layer**: `npm run test:concurrency` / `npm run test:int`

### Step 5: Document Edge Cases & Boundary Analysis
Document verified edge conditions:
- Empty payloads
- Boundary numbers (budget <= 0, negative prices)
- Race condition results (e.g. 10 parallel accepts => 1 accept, 9 conflicts)
- Replay attack results (e.g. duplicate webhook => 0 double writes)

### Step 6: Log Defects & Resolutions
If bugs were discovered during testing, record:
- Bug ID, Description, Root Cause, Resolution, and Retest Status (`VERIFIED FIXED`).
- If no defects occurred: record `"No defects identified during SQA cycle."`

### Step 7: Update Project Trackers
Once the report is saved:
1. In `context/feature-specs/INDEX.md`, change status to `☑ Passed` and add link to `feature-test-reports/FEAT-XXX-test-report.md`.
2. In `context/progress-tracker.md`, move feature from "In Progress" to "Completed" with the test report link.
