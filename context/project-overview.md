# Real-Time Service Marketplace (FlogenAI) — Project Overview

## Overview

A full-stack, horizontally scalable real-time service marketplace where Customers create service requests and Providers submit competing offers in real time. The platform features strict concurrency control to prevent double-acceptance race conditions across distributed backend nodes, secure Stripe payments with idempotent webhook processing, authenticated real-time chat between customers and providers, and horizontal scaling across multiple NestJS backend instances backed by Redis Pub/Sub and MongoDB.

## Goals

1. **Horizontally Scalable Real-Time Engine**: Deliver real-time notifications (`request:created`, `offer:created`, `offer:accepted`, chat messages) across at least 2 NestJS backend instances using Socket.IO and the Redis Pub/Sub Adapter.
2. **Deterministic Concurrency Control**: Guarantee zero double-acceptances when multiple concurrent acceptance requests hit different backend instances at the same millisecond, using Redis distributed locking and atomic MongoDB conditional mutations.
3. **Robust Stripe Payment Lifecycle**: Integrate Stripe Test Mode with server-calculated amounts, cryptographic webhook signature verification, and idempotent event processing preventing duplicate transactions.
4. **Zero-Trust Security & Authorization**: Enforce JWT authentication on both REST endpoints and Socket.IO handshakes, server-side RBAC (Customer vs. Provider), strict resource ownership checks, and room authorization for chat.
5. **Turnkey Dockerized Multi-Node Infrastructure**: Spin up the entire multi-instance environment (Next.js 16 frontend, NestJS Instance 1, NestJS Instance 2, MongoDB, Redis, Nginx Load Balancer) with a single `docker compose up`.

## Core User Flow

1. **Authentication**: Users register or log in as either a `CUSTOMER` or a `PROVIDER`, receiving a cryptographically signed JWT.
2. **Request Publication**: A Customer creates a service request (title, description, budget). The backend emits `request:created` via Socket.IO/Redis, instantly appearing on connected Providers' dashboards.
3. **Offer Submission**: Connected Providers view open requests and submit offers (price, proposal message). The backend emits `offer:created` directly to the owning Customer in real time.
4. **Offer Acceptance & Concurrency Lock**: Customer reviews incoming offers and accepts one. The backend acquires a distributed lock on the request, verifies single-acceptance validity, marks the request accepted, rejects other offers, and emits `offer:accepted` to the selected provider.
5. **Secure Payment**: A Stripe PaymentIntent is created for the accepted offer price (backend-enforced amount). The customer completes payment in Stripe Test Mode.
6. **Webhook Reconciliation**: Stripe triggers `payment_intent.succeeded`. The NestJS webhook receiver verifies the signature, idempotently updates payment status to `SUCCEEDED` and request status to `PAID`.
7. **Real-Time Communication**: Upon payment/acceptance, Customer and Provider enter an authenticated real-time chat room, exchanging messages persisted in MongoDB and relayed across backend instances.

## Features

### Authentication & Authorization
- Customer and Provider registration & login.
- Password hashing with bcrypt.
- JWT access tokens and role-based guards (RBAC).
- Authenticated Socket.IO connections verifying JWTs during the handshake.

### Service Requests & Marketplace Feed
- Customer request creation with validation (title, description, budget > 0).
- Paginated feed of open requests for providers with status filtering.
- Customer dashboard showing all authored requests and status.
- Real-time `request:created` broadcast via Redis Pub/Sub adapter.

### Offers & Concurrency Challenge
- Provider offer submission against open requests with price validation.
- Real-time `offer:created` dispatch to the specific customer.
- Distributed mutual exclusion via Redis lock (`lock:request:<id>`) combined with atomic MongoDB conditional updates (`findOneAndUpdate({ _id: requestId, status: 'OPEN' })`).
- Elimination of double-acceptance race conditions across distributed nodes.
- Real-time `offer:accepted` dispatch to the winning provider and request-closed notification to others.

### Stripe Payments & Webhooks
- Server-side PaymentIntent creation based strictly on the accepted offer price.
- Stripe Elements / Test Mode payment flow on the frontend.
- Cryptographic webhook signature verification (`stripe.webhooks.constructEvent`).
- Idempotent webhook processing recording processed event IDs to prevent replay attacks and duplicate state transitions.

### Real-Time Chat
- Direct customer-to-provider messaging room for accepted requests.
- MongoDB persistence for all conversation and message entities.
- Server-side room authorization preventing unauthorized users from eavesdropping or sending messages.
- Socket.IO events: `conversation:join`, `message:send`, `message:new`.

### Horizontal Scaling & Infrastructure
- At least 2 NestJS backend instances running concurrently.
- Socket.IO Redis adapter broadcasting events across instances.
- Nginx reverse proxy load balancer routing HTTP and WebSocket traffic.
- Docker Compose orchestration with healthchecks.

## Scope

### In Scope
- NestJS REST API with modular architecture (`auth`, `requests`, `offers`, `payments`, `chat`, `redis`, `events`).
- Next.js 16 (App Router, TypeScript, React 19) minimal, high-clarity frontend for Customer and Provider journeys.
- MongoDB persistence with Mongoose (User, ServiceRequest, Offer, Payment, Conversation, Message, ProcessedEvent).
- Socket.IO gateway with Redis Adapter and handshake auth.
- Redis distributed lock service for concurrency safety.
- Stripe test mode integration with idempotent webhook receiver.
- Multi-instance Docker Compose environment.
- Automated multi-layer tests (Unit, API, Concurrency Race, Webhook Idempotency, Socket.IO cross-instance).
- Standardized SQA test reports using `feature-test-reports/template-test-report.md`.

### Out of Scope
- Complex UI animations, themes, or public marketing pages.
- Third-party social logins (OAuth / Google / GitHub).
- Live Stripe production payments or dispute management.
- Video/audio calling or file attachments in chat.
- Advanced search engines (Elasticsearch / Algolia).

## Success Criteria

1. **Race Condition Prevention**: Sending 10 concurrent HTTP acceptance requests for the same service request across NestJS Instance 1 and Instance 2 results in exactly 1 successful acceptance (`200 OK`) and 9 rejected requests (`409 Conflict`), with zero state corruption.
2. **Cross-Instance Real-Time Delivery**: A Customer connected via WebSocket to NestJS Instance 1 receives real-time offer submissions created by a Provider connected to NestJS Instance 2.
3. **Webhook Idempotency**: Submitting the same Stripe `payment_intent.succeeded` webhook payload 3 consecutive times updates the database exactly once and returns `200 OK` on duplicates without side-effects.
4. **Zero-Trust Room Access**: An authenticated Customer attempting to emit `conversation:join` for an unrelated request ID is denied by the server gateway with an unauthorized error.
5. **Automated Test Gate**: 100% test pass rate across all layers with individual test reports generated in `feature-test-reports/` using the official template.
