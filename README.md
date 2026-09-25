# FlogenAI--Task

# Real-Time Service Marketplace (FlogenAI)

Full-stack, horizontally scalable real-time service marketplace where Customers create service requests and Providers submit competing offers in real time, featuring Redis distributed locking, atomic MongoDB conditional updates, Stripe payment test-mode integration with idempotent webhooks, authenticated Socket.IO chat, and dual-instance NestJS scaling behind Nginx.

---

## Tech Stack

- **Frontend**: Next.js (App Router, TypeScript, React 19)
- **Backend**: NestJS (TypeScript, Node.js, running across 2 instances)
- **Load Balancer**: Nginx (reverse proxy, WebSocket upgrade, sticky sessions)
- **Database**: MongoDB (Mongoose ODM)
- **Broker / Cache / Mutex**: Redis (ioredis, Socket.IO Redis Adapter, distributed lock)
- **Payments**: Stripe Test Mode (PaymentIntents, Webhook Signature Verification, Idempotency)
- **Containerization**: Docker & Docker Compose

---

## Project Structure & Architecture

```
FlogenAI/
├── .agents/
│   ├── rules/                 # Auto-discovered pre-prompt workspace rules
│   └── skills/                # Specialized LLM runbooks (concurrency, stripe, scaling, etc.)
├── context/
│   ├── architecture.md        # System architecture, boundaries, storage, and invariants
│   ├── ai-workflow-rules.md   # AI agent execution rules and quality gates
│   ├── code-standards.md      # Coding and architectural standards
│   ├── progress-tracker.md    # Real-time pipeline tracker
│   ├── project-overview.md    # High-level goals, user flows, and scope
│   ├── testing-strategy.md    # 4-layer SQA testing matrix & DoD checklist
│   ├── ui-context.md          # Design tokens, themes, layouts, and typography
│   └── feature-specs/         # Spec-driven feature files (plan.md sequence)
│       ├── 000-shared-contracts.md
│       ├── 000-nonfunctional-contracts.md
│       ├── 000-infra-contracts.md
│       ├── INDEX.md
│       ├── FEAT-001 through FEAT-006 (BE, FE, INT, VERIFY)
│       └── epics/EPIC-001-VERIFY-marketplace-lifecycle.md
├── feature-test-reports/
│   ├── README.md
│   └── template-test-report.md # Master SQA test report template
├── rules/                     # Mirrored workspace rules
├── AGENTS.md                  # Root agent instructions
└── GEMINI.md                  # Root agent instructions
```

---

## Core Engineering Decisions

1. **Two-Tier Concurrency Guard**:
   - Double-acceptance of offers across multiple NestJS instances is physically prevented using Redis distributed locks (`mkt:lock:request:<id>`) combined with atomic MongoDB conditional updates (`findOneAndUpdate({ _id: requestId, status: 'OPEN' })`).
2. **Stripe Idempotency & Raw-Body Verification**:
   - Webhook signatures are verified cryptographically against the raw unparsed request buffer (`stripe.webhooks.constructEvent`).
   - Processed event IDs are recorded in `processed_events`. Replayed events return HTTP `200 OK` with zero duplicate mutations.
3. **Horizontal Socket.IO Scaling**:
   - Socket.IO nodes synchronize events (`request:created`, `offer:created`, `offer:accepted`, `message:new`) across instances via Redis Pub/Sub adapter.
4. **Zero-Trust Security**:
   - JWT validation on both REST endpoints and Socket.IO handshakes.
   - Server-side room authorization for chat (`conversation:<id>`). Clients cannot join arbitrary rooms.
5. **100% SQA Gate**:
   - Every feature must pass multi-layer automated tests (Frontend fake DOM, API, Backend logic, Database/concurrency) with formal reports saved in `feature-test-reports/`.
