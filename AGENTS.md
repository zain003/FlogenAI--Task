# Workspace Rules — Real-Time Service Marketplace (FlogenAI)

> **MANDATORY PRE-PROMPT PROTOCOL**: Before executing any prompt or writing any code, the AI agent must read:
> 1. The 7 context files in `context/`:
>    - `context/project-overview.md`
>    - `context/architecture.md`
>    - `context/ai-workflow-rules.md`
>    - `context/code-standards.md`
>    - `context/progress-tracker.md`
>    - `context/testing-strategy.md`
>    - `context/ui-context.md`
> 2. The rules in `.agents/rules/` and `rules/`
> 3. The current feature specification in `context/feature-specs/`
> 4. The relevant specialized skill in `.agents/skills/`

---

## Core Workspace Invariants

1. **Spec-Driven Implementation**: Implement one feature at a time strictly according to `context/feature-specs/` and `plan.md`. Never invent un-specified data models or API routes.
2. **Concurrency Invariant**: Double-acceptance of offers across multiple NestJS backend instances must be physically prevented using Redis distributed locks (`lock:request:<id>`) combined with atomic MongoDB conditional updates (`findOneAndUpdate({ _id: id, status: 'OPEN' })`).
3. **Stripe Idempotency & Verification**: Webhooks must verify cryptographic signatures (`stripe.webhooks.constructEvent`) and record processed event IDs in `processed_events`. Duplicate events must return `200 OK` with zero side-effects.
4. **Horizontal Scaling**: Socket.IO events must be synchronized across backend instances via Redis Pub/Sub adapter.
5. **Zero Failing Tests**: Multi-layer tests (Frontend Fake DOM, API, Backend logic, Database/concurrency) must pass 100% before marking any feature complete.
6. **Mandatory SQA Test Reports**: After implementing and verifying each feature (`FEAT-XXX-VERIFY`), immediately generate a test report using `feature-test-reports/template-test-report.md` and save it to `feature-test-reports/FEAT-XXX-test-report.md`.

---

## Workspace Skills Catalog

The agent must activate and follow these specialized skills for complex workflows:

| Skill Name | Location | Purpose & Activation Trigger |
| :--- | :--- | :--- |
| **`implement-feature`** | `.agents/skills/implement-feature/SKILL.md` | Use when building any `BE`, `FE`, `INT`, or `VERIFY` layer of a feature spec. |
| **`verify-concurrency`** | `.agents/skills/verify-concurrency/SKILL.md` | Use when implementing or testing Redis distributed locks and parallel race conditions for offer acceptance. |
| **`stripe-idempotency`** | `.agents/skills/stripe-idempotency/SKILL.md` | Use when implementing or verifying Stripe PaymentIntents and raw-body webhook signature idempotency. |
| **`socketio-scaling`** | `.agents/skills/socketio-scaling/SKILL.md` | Use when configuring or verifying multi-instance Socket.IO clustering via Redis Pub/Sub adapter and Docker. |
| **`sqa-test-reporting`** | `.agents/skills/sqa-test-reporting/SKILL.md` | Use when authoring formal SQA test reports in `feature-test-reports/` using the master template. |

---

## Recommended Slash Commands

- Use `/plan` when planning a complex multi-file feature implementation or architectural change.
- Use `/goal` when executing an end-to-end feature build and verification pass requiring thorough multi-layer testing.
