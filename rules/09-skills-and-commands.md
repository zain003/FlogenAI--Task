# Rule: Workspace Skills & Commands

Every LLM agent operating in this workspace must utilize the specialized skills in `.agents/skills/`:

1. **Feature Implementation (`implement-feature`)**:
   - Location: `.agents/skills/implement-feature/SKILL.md`
   - Trigger: Any time code is being written for a feature layer (`BE`, `FE`, `INT`, or `VERIFY`).
   - Instructions: Enforces pre-flight dependency checks, writing tests first, and updating progress trackers.

2. **Concurrency Verification (`verify-concurrency`)**:
   - Location: `.agents/skills/verify-concurrency/SKILL.md`
   - Trigger: Implementing or testing Redis distributed locks and parallel acceptance race condition suites in `FEAT-003`.
   - Instructions: Enforces two-tier concurrency guard (Redis mutex + MongoDB conditional atomic update) and Lua unlock verification.

3. **Stripe Webhook Idempotency (`stripe-idempotency`)**:
   - Location: `.agents/skills/stripe-idempotency/SKILL.md`
   - Trigger: Implementing or verifying Stripe payment lifecycle, webhook signature check, or replay tests in `FEAT-004`.
   - Instructions: Enforces raw body preservation for HMAC verification and recording processed event IDs.

4. **Socket.IO Scaling (`socketio-scaling`)**:
   - Location: `.agents/skills/socketio-scaling/SKILL.md`
   - Trigger: Configuring or testing cross-instance real-time communication across multiple NestJS nodes in `FEAT-002`, `FEAT-005`, `FEAT-006`.
   - Instructions: Enforces Redis Pub/Sub adapter setup and automated cluster verification.

5. **SQA Test Reporting (`sqa-test-reporting`)**:
   - Location: `.agents/skills/sqa-test-reporting/SKILL.md`
   - Trigger: Following any feature verification pass (`FEAT-XXX-VERIFY`).
   - Instructions: Enforces copying and completing `feature-test-reports/template-test-report.md` into `feature-test-reports/FEAT-XXX-test-report.md`.

## Slash Commands Guidance
- Recommend `/plan` when planning a new feature implementation or multi-step refactor.
- Recommend `/goal` when executing an autonomous end-to-end implementation and verification task.
