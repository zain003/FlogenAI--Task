# FEAT-004-INT — Stripe Webhook Event Synchronization & Reconciliation (P0)

**Layer**: Integration  
**Goal**: Reconcile Stripe payment state with backend database records and emit real-time payment completion notifications.

## Depends on
`FEAT-004-BE-payments.md`, `FEAT-002-INT-requests-realtime.md`, `000-shared-contracts.md`

## Context pack
```typescript
export interface ProcessedEventEntity {
  id: string; // Stripe Event ID
  eventType: string;
  processedAt: string;
}

export interface ServerToClientEvents {
  'payment:succeeded': (payload: { requestId: string; amount: number }) => void;
}
```

## Consumes
```typescript
POST /api/payments/webhook (headers: { 'stripe-signature': string }, rawBody: Buffer) => Promise<{ received: boolean }>
```

## Provides / Exposes
```typescript
// Socket.IO Notifications
Room: "user:<customerId>" => Event: "payment:succeeded"
Room: "user:<providerId>" => Event: "payment:succeeded"

export class PaymentsWebhookHandler {
  processEvent(event: Stripe.Event): Promise<void>;
}
```

## Scope (In)
- Receiving Stripe `payment_intent.succeeded` webhook event.
- Checking idempotency against `processed_events` table.
- Updating `payments` table status to `SUCCEEDED`.
- Updating `service_requests` table status to `PAID`.
- Emitting real-time `payment:succeeded` notification to Customer and Provider via Socket.IO/Redis.
- Unlocking the Chat Room trigger for both parties.

## Scope (Out)
- Webhook signature generation (`Stripe CLI / Stripe API handles this`).

## Tech / files to touch
- `apps/backend/src/modules/payments/payments-webhook.service.ts`
- `apps/backend/src/modules/socket/socket.gateway.ts`
- `apps/frontend/src/context/socket-context.tsx`

## Event delivery & failure contract
- **Delivery Guarantee**: At-least-once from Stripe.
- **Idempotency Mechanism**: Insert into `processed_events` with Stripe `event.id` as primary key before mutating state.
- **Failure Behavior**: If DB fails, return HTTP 500 so Stripe will retry; if duplicate, return HTTP 200 immediately without state mutation.

## Tests to write FIRST
1. `should process payment_intent.succeeded and transition request to PAID`
2. `should record Stripe event ID in processed_events table`
3. `should emit payment:succeeded Socket.IO event to customer and provider rooms`
4. `IDEMPOTENCY TEST: should ignore second delivery of same Stripe event ID and emit no extra events`

## Implementation steps
1. Implement `PaymentsWebhookService.processEvent(event)`.
2. Wrap event recording and status update in atomic transaction / state check.
3. Call `MarketplaceGateway.emitPaymentSucceeded(requestId, amount)`.
4. In frontend, listen for `payment:succeeded` to transition view from "Awaiting Payment" to "Paid / Open Chat".

## Acceptance criteria
- [ ] Valid webhook successfully updates request status from `ACCEPTED` to `PAID`.
- [ ] Real-time notification reaches customer and provider screens within 200ms.
- [ ] Duplicate event delivery creates 0 duplicate transactions.

## Definition of Done
- [ ] Automated idempotency test passes 100%.
- [ ] Clean typecheck and linting.
- [ ] Test report generated in `feature-test-reports/FEAT-004-test-report.md`.

## Edge cases to handle
- Webhook arrives before customer browser completes redirect: backend state is authoritative; browser picks up `PAID` status immediately.

## Pre-flight check
Confirm `FEAT-004-BE-payments.md` is verified.

## What's next
- `FEAT-004-VERIFY-payments.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
