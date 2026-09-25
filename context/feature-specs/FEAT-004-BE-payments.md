# FEAT-004-BE — Stripe PaymentIntents & Idempotent Webhook Engine (P0)

**Layer**: Backend  
**Goal**: Create Stripe PaymentIntents with backend-enforced pricing, verify webhook signatures cryptographically, and process payment events idempotently.

## Depends on
`FEAT-003-VERIFY-offers.md`, `000-shared-contracts.md`, `000-nonfunctional-contracts.md`

## Context pack
```typescript
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PaymentEntity {
  id: string;
  requestId: string;
  offerId: string;
  customerId: string;
  providerId: string;
  amount: number; // in cents
  currency: 'usd';
  status: PaymentStatus;
  stripePaymentIntentId: string;
  createdAt: string;
}

export interface ProcessedEventEntity {
  id: string; // Stripe Event ID
  eventType: string;
  processedAt: string;
}

export interface CreatePaymentIntentDto {
  offerId: string;
}
```

## Consumes
```typescript
GET /api/offers/:id/accept (param: id) => Promise<{ success: boolean; offer: OfferEntity }>
```

## Provides / Exposes
```typescript
POST /api/payments/create-intent (auth: Customer, body: CreatePaymentIntentDto) => Promise<PaymentIntentResponseDto>
POST /api/payments/webhook       (headers: { 'stripe-signature': string }, rawBody: Buffer) => Promise<{ received: boolean }>
GET  /api/payments/by-request/:id (auth: Customer | Provider) => Promise<PaymentEntity>
```

## Scope (In)
- Payment Mongoose schema with unique index on `stripePaymentIntentId`.
- ProcessedEvent Mongoose schema with `_id` set to Stripe `eventId`.
- Backend-enforced pricing: fetch price strictly from accepted `Offer` entity, convert to cents (`amount = price * 100`).
- Calling `stripe.paymentIntents.create` with metadata `{ requestId, offerId, customerId, providerId }`.
- Webhook endpoint `/api/payments/webhook`:
  - Verify signature using `stripe.webhooks.constructEvent(rawBody, sig, secret)`.
  - Check if `event.id` exists in `processed_events`. If exists, return HTTP 200 immediately (Idempotency).
  - Record `event.id` in `processed_events`.
  - Handle `payment_intent.succeeded`: transition payment status to `SUCCEEDED`, transition request status to `PAID`.
  - Handle `payment_intent.payment_failed`: transition payment status to `FAILED`.

## Scope (Out)
- Live production Stripe credentials (`Test mode sk_test_... only`).
- Frontend payment form (`FEAT-004-FE`).

## Tech / files to touch
- `apps/backend/src/modules/payments/payments.controller.ts`
- `apps/backend/src/modules/payments/payments.service.ts`
- `apps/backend/src/modules/payments/stripe.service.ts`
- `apps/backend/src/modules/payments/schemas/payment.schema.ts`
- `apps/backend/src/modules/payments/schemas/processed-event.schema.ts`

## Nonfunctional requirements
- Security: Never store cardholder data or CVV.
- Verification: Raw body must be preserved for HMAC-SHA256 signature verification.
- Idempotency: Replaying the same webhook event 3 times results in exactly 1 state mutation and 3 HTTP 200 responses.

## Tests to write FIRST
1. `should reject create-intent when caller is not the customer who accepted the offer`
2. `should calculate PaymentIntent amount on backend and ignore client-supplied amount`
3. `should reject webhook call with invalid signature with HTTP 400`
4. `should update payment to SUCCEEDED and request to PAID on payment_intent.succeeded`
5. `WEBHOOK IDEMPOTENCY TEST: should handle duplicate webhook events without double-updating database`
6. `should update payment to FAILED on payment_intent.payment_failed`

## Implementation steps
1. Define Mongoose `PaymentSchema` and `ProcessedEventSchema`.
2. Configure `StripeModule` reading `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. In `PaymentsService.createPaymentIntent`, query accepted offer, compute amount in cents, create Stripe PaymentIntent, and save `Payment` record with status `PENDING`.
4. In `PaymentsService.handleWebhook`, verify raw body signature with `constructEvent`, query `ProcessedEventModel.findById(event.id)`, record event, and execute state transitions.
5. In `PaymentsController`, configure raw body middleware for `/api/payments/webhook`.

## Acceptance criteria
- [ ] Customer initiates payment; backend creates PaymentIntent with exact offer price.
- [ ] Webhook signature verification fails cleanly with HTTP 400 when signature is tampered.
- [ ] Valid `payment_intent.succeeded` updates payment to `SUCCEEDED` and request to `PAID`.
- [ ] Duplicate webhook delivery returns HTTP 200 with zero duplicate database mutations.

## Definition of Done
- [ ] Unit, API, and idempotency tests pass 100%.
- [ ] Clean typecheck and linting.
- [ ] Test report generated in `feature-test-reports/FEAT-004-test-report.md`.

## Edge cases to handle
- Client retries payment after failure: reuse or regenerate PaymentIntent without orphaned pending records.

## Pre-flight check
Confirm `FEAT-003-VERIFY-offers.md` is verified.

## What's next
- `FEAT-004-FE-payments.md` and `FEAT-004-INT-payments-webhook.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
