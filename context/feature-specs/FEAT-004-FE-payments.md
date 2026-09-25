# FEAT-004-FE — Stripe Payment Integration & Checkout UI (P0)

**Layer**: Frontend  
**Goal**: Integrate Stripe Elements (Test Mode) into Next.js so Customers can enter test card details and pay for accepted service offers.

## Depends on
`FEAT-004-BE-payments.md`, `FEAT-003-FE-offers.md`, `context/ui-context.md`

## Context pack
```typescript
export interface PaymentIntentResponseDto {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}
```

## Consumes
```typescript
POST /api/payments/create-intent (body: { offerId: string }) => Promise<PaymentIntentResponseDto>
GET  /api/payments/by-request/:id (param: id) => Promise<PaymentEntity>
```

## Scope (In)
- Payment modal launched when Customer clicks "Proceed to Payment" on accepted offer.
- Embedding `@stripe/react-stripe-js` and `@stripe/stripe-js` (`Elements`, `CardElement` / `PaymentElement`).
- Displaying price breakdown: Service offer amount in USD.
- Handling Stripe card submission and test card testing (`4242 4242 4242 4242`).
- Payment confirmation screen and status polling / webhook wait state.

## Scope (Out)
- Webhook signature processing (`FEAT-004-BE`).
- Production card networks (`Test Mode only`).

## Tech / files to touch
- `apps/frontend/src/app/requests/[id]/page.tsx`
- `apps/frontend/src/components/payments/payment-modal.tsx`
- `apps/frontend/src/components/payments/stripe-checkout-form.tsx`
- `apps/frontend/src/lib/stripe-client.ts`

## Nonfunctional requirements
- Security: Never inspect, read, or send raw card details through Next.js server actions or custom APIs.
- User feedback: Clear spinner during Stripe confirmation; descriptive error message if card is declined.
- Focus trap in payment modal.

## Tests to write FIRST
1. `should render payment modal with offer price and Stripe Elements container`
2. `should disable pay button while processing Stripe payment`
3. `should display error alert when card confirmation returns error`
4. `should display payment success confirmation when Stripe confirms payment`

## Implementation steps
1. Initialize Stripe in `stripe-client.ts` with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Implement `PaymentModal` requesting `create-intent` from backend and wrapping child form in `<Elements stripe={stripePromise} options={{ clientSecret }}>`.
3. Implement `StripeCheckoutForm` with `useStripe`, `useElements`, and card input.
4. On submit, invoke `stripe.confirmCardPayment(clientSecret)`.
5. Display success receipt and update request view status to `PAID`.

## Acceptance criteria
- [ ] Customer opens payment modal and sees verified offer amount.
- [ ] Submitting Stripe test card `4242...` initiates payment and displays success checkmark.
- [ ] Submitting declined test card (`4000...`) shows inline decline error without closing modal.

## Definition of Done
- [ ] Vitest fake DOM tests pass 100%.
- [ ] Clean typecheck and linting.

## Edge cases to handle
- Customer closes modal mid-flow: client secret remains valid for re-attempt.

## Pre-flight check
Confirm `FEAT-004-BE-payments.md` is verified.

## What's next
- `FEAT-004-INT-payments-webhook.md` and `FEAT-004-VERIFY-payments.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
