---
name: stripe-idempotency
description: >-
  Use this skill when implementing, testing, or verifying Stripe payments, webhook cryptographic signature verification, and idempotent webhook handling in FEAT-004.
---

# Stripe Webhook Verification & Idempotency Runbook

This skill provides step-by-step instructions for implementing and verifying Stripe payments with raw-body cryptographic signature verification and idempotent event handling.

## Core Rules for Stripe Integration

1. **Server-Determined Pricing**: Never use client-supplied payment amounts. The backend queries the accepted offer from MongoDB and calculates the amount in cents (`amount = offer.price * 100`).
2. **Raw Body Requirement**: Signature verification (`stripe.webhooks.constructEvent`) requires the raw unparsed request buffer. JSON-parsed bodies will fail HMAC-SHA256 signature verification.
3. **Strict Idempotency**: Stripe guarantees at-least-once delivery and will retry failed or unacknowledged webhooks. Your receiver must handle duplicate event deliveries with zero side-effects.

## Webhook Architecture Flow

```
Stripe Webhook Delivery
          │
          ▼
1. Extract 'stripe-signature' header & raw body buffer
          │
          ▼
2. Verify Signature: stripe.webhooks.constructEvent(rawBody, sig, secret)
   - If invalid => return HTTP 400 Bad Request
          │ (Valid signature)
          ▼
3. Idempotency Check in MongoDB:
   - Query: await ProcessedEventModel.findById(event.id)
   - If found => Event already processed! Return HTTP 200 { received: true } immediately.
          │ (New event)
          ▼
4. Record Event ID in ProcessedEventModel:
   - await ProcessedEventModel.create({ _id: event.id, eventType: event.type, processedAt: new Date() })
          │
          ▼
5. Process Domain Event:
   - Case 'payment_intent.succeeded':
       - Update Payment status to 'SUCCEEDED'
       - Update ServiceRequest status to 'PAID'
       - Emit Socket.IO event 'payment:succeeded'
   - Case 'payment_intent.payment_failed':
       - Update Payment status to 'FAILED'
          │
          ▼
6. Return HTTP 200 { received: true }
```

## Automated Idempotency Test Pattern

Create an automated test in `apps/backend/src/modules/payments/webhook.spec.ts`:

```typescript
describe('Stripe Webhook Idempotency Suite', () => {
  it('should process webhook once and return 200 on replay with zero side-effects', async () => {
    const eventId = 'evt_test_' + Date.now();
    const payload = generateMockStripeEvent(eventId, 'payment_intent.succeeded', paymentIntentId);
    const signature = generateStripeSignature(payload, webhookSecret);

    // Call 1: First delivery
    const res1 = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('stripe-signature', signature)
      .send(payload);
    expect(res1.status).toBe(200);

    // Assert database updated to PAID
    const request1 = await requestModel.findById(requestId);
    expect(request1.status).toBe('PAID');

    // Call 2: Replay delivery (duplicate)
    const res2 = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('stripe-signature', signature)
      .send(payload);
    expect(res2.status).toBe(200);

    // Call 3: Third replay
    const res3 = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('stripe-signature', signature)
      .send(payload);
    expect(res3.status).toBe(200);

    // Assert that processed_events has exactly ONE entry and no duplicate payment records exist
    const events = await processedEventModel.find({ _id: eventId });
    expect(events.length).toBe(1);

    const payments = await paymentModel.find({ stripePaymentIntentId: paymentIntentId });
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('SUCCEEDED');
  });
});
```
