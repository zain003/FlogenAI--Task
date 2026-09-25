# Feature Specifications Index & Tracking Matrix

This index tracks all feature specifications, dependencies, implementation status, and SQA verification records.

---

## Specification Catalog

| File ID | Layer | Priority | Feature Name | Depends On | Est. Lines | Status | Test Report |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-001-BE** | Backend | P0 | Auth & RBAC (JWT, bcrypt) | `000-shared-contracts.md` | ~120 | ☑ Passed | [`feature-test-reports/FEAT-001-test-report.md`](../../feature-test-reports/FEAT-001-test-report.md) |
| **FEAT-001-FE** | Frontend | P0 | Auth UI (Login & Register) | `FEAT-001-BE` | ~110 | ☑ Passed | [`feature-test-reports/FEAT-001-test-report.md`](../../feature-test-reports/FEAT-001-test-report.md) |
| **FEAT-001-VERIFY** | Verify | P0 | Auth SQA Verification Pass | `FEAT-001-BE`, `FEAT-001-FE` | ~70 | ☑ Passed | [`feature-test-reports/FEAT-001-test-report.md`](../../feature-test-reports/FEAT-001-test-report.md) |
| **FEAT-002-BE** | Backend | P0 | Service Requests REST CRUD | `FEAT-001-VERIFY` | ~130 | ☑ Passed | [`feature-test-reports/FEAT-002-test-report.md`](../../feature-test-reports/FEAT-002-test-report.md) |
| **FEAT-002-FE** | Frontend | P0 | Request Creation & Feeds | `FEAT-002-BE` | ~120 | ☑ Passed | - |
| **FEAT-002-INT** | Integration| P0 | Socket.IO `request:created` Broadcast | `FEAT-002-BE` | ~110 | ☑ Passed | - |
| **FEAT-002-VERIFY** | Verify | P0 | Requests SQA Verification Pass | `FEAT-002-BE`, `FEAT-002-FE`, `FEAT-002-INT` | ~80 | ☑ Passed | [`feature-test-reports/FEAT-002-test-report.md`](../../feature-test-reports/FEAT-002-test-report.md) |
| **FEAT-003-BE** | Backend | P0 | Offers & Concurrency Lock | `FEAT-002-VERIFY` | ~140 | ☑ Passed | - |
| **FEAT-003-FE** | Frontend | P0 | Offer Submission & Accept UI | `FEAT-003-BE` | ~115 | ☑ Passed | - |
| **FEAT-003-INT** | Integration| P0 | Real-Time Offer Events & Updates | `FEAT-003-BE` | ~110 | ☑ Passed | [`feature-test-reports/FEAT-003-test-report.md`](../../feature-test-reports/FEAT-003-test-report.md) |
| **FEAT-003-VERIFY** | Verify | P0 | Offers & Race Condition Verification | `FEAT-003-BE`, `FEAT-003-FE`, `FEAT-003-INT` | ~85 | ☑ Passed | [`feature-test-reports/FEAT-003-test-report.md`](../../feature-test-reports/FEAT-003-test-report.md) |
| **FEAT-004-BE** | Backend | P0 | Stripe PaymentIntent & Idempotent Webhook | `FEAT-003-VERIFY` | ~140 | ☑ Passed | [`feature-test-reports/FEAT-004-test-report.md`](../../feature-test-reports/FEAT-004-test-report.md) |
| **FEAT-004-FE** | Frontend | P0 | Stripe Elements Checkout UI | `FEAT-004-BE` | ~110 | ☑ Passed | - |
| **FEAT-004-INT** | Integration| P0 | Webhook State Reconciler | `FEAT-004-BE` | ~110 | ☐ Not Started | - |
| **FEAT-004-VERIFY** | Verify | P0 | Payments & Webhook Idempotency Verification | `FEAT-004-BE`, `FEAT-004-FE`, `FEAT-004-INT` | ~80 | ☐ Not Started | `feature-test-reports/FEAT-004-test-report.md` |
| **FEAT-005-BE** | Backend | P0 | Chat Conversations & Messages | `FEAT-003-VERIFY` | ~120 | ☐ Not Started | - |
| **FEAT-005-FE** | Frontend | P0 | Real-Time Chat Widget | `FEAT-005-BE` | ~115 | ☐ Not Started | - |
| **FEAT-005-INT** | Integration| P0 | Socket.IO Room Auth & Messaging Gateway | `FEAT-005-BE` | ~125 | ☐ Not Started | - |
| **FEAT-005-VERIFY** | Verify | P0 | Chat & Room Authorization Verification | `FEAT-005-BE`, `FEAT-005-FE`, `FEAT-005-INT` | ~80 | ☐ Not Started | `feature-test-reports/FEAT-005-test-report.md` |
| **FEAT-006-INT** | Integration| P0 | Multi-Instance Scaling & Docker Setup | `FEAT-001`–`FEAT-005` | ~130 | ☐ Not Started | - |
| **FEAT-006-VERIFY** | Verify | P0 | Cross-Instance WebSocket & Load Balancing | `FEAT-006-INT` | ~80 | ☐ Not Started | `feature-test-reports/FEAT-006-test-report.md` |
| **EPIC-001-VERIFY**| Epic Verify| P0 | Full Marketplace End-to-End Journey | `FEAT-001`–`FEAT-006` | ~100 | ☐ Not Started | `feature-test-reports/EPIC-001-test-report.md` |

---

## Status Legend
- ☐ `Not Started`
- ⏳ `In Progress`
- ☑ `Passed` (All automated tests pass 100% and test report committed)
- ⚠ `STALE — needs re-sync` (Upstream interface changed; requires re-verification)
