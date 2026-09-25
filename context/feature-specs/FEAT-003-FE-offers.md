# FEAT-003-FE — Offers UI & Customer Acceptance Flow (P0)

**Layer**: Frontend  
**Goal**: Build the Provider offer submission form and Customer offer evaluation/acceptance view in Next.js 16.

## Depends on
`FEAT-003-BE-offers.md`, `FEAT-002-FE-requests.md`, `context/ui-context.md`

## Context pack
```typescript
export interface OfferEntity {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  message: string;
  status: OfferStatus;
  createdAt: string;
}

export interface CreateOfferDto {
  price: number;
  message: string;
}
```

## Consumes
```typescript
POST /api/requests/:id/offers (body: CreateOfferDto) => Promise<OfferEntity>
GET  /api/requests/:id/offers (param: id) => Promise<PaginatedResponse<OfferEntity>>
POST /api/offers/:id/accept   (param: id) => Promise<{ success: boolean; offer: OfferEntity }>
```

## Scope (In)
- Provider "Submit Offer" modal/drawer on request detail page (`/requests/[id]`).
- Customer "Offers Stream" on `/requests/[id]` showing all received offers with price, message, provider info, and status.
- "Accept Offer" button with confirmation prompt and loading spinner.
- Disabling acceptance button once an offer is accepted.

## Scope (Out)
- Real-time Socket.IO arrivals (`FEAT-003-INT`).
- Stripe checkout form (`FEAT-004-FE`).

## Tech / files to touch
- `apps/frontend/src/app/requests/[id]/page.tsx`
- `apps/frontend/src/components/offers/submit-offer-dialog.tsx`
- `apps/frontend/src/components/offers/offer-list.tsx`
- `apps/frontend/src/components/offers/offer-card.tsx`

## Nonfunctional requirements
- Clear monetary representation: prices formatted as `$XX.XX`.
- Double-click prevention: "Accept" button disabled immediately upon first click.
- Accessibility: modal handles focus trap and ESC key.

## Tests to write FIRST
1. `should render submit offer button only for provider users`
2. `should validate offer price is greater than 0 before submission`
3. `should render list of offers with price, provider name, and message`
4. `should trigger accept offer mutation when customer clicks accept`
5. `should disable accept buttons on all offers once one offer is accepted`

## Implementation steps
1. Build `SubmitOfferDialog` with price input and proposal message.
2. Build `OfferCard` displaying offer price, message, status badge (`PENDING`, `ACCEPTED`, `REJECTED`), and "Accept Offer" button (visible only to customer owner).
3. Build `OfferList` container fetching `/api/requests/:id/offers`.
4. Handle acceptance action: call `POST /api/offers/:id/accept`, update local state to reflect accepted status, and prompt to proceed to payment.

## Acceptance criteria
- [ ] Provider submits offer and sees confirmation toast.
- [ ] Customer sees all offers submitted for their request.
- [ ] Clicking "Accept" updates UI instantly to show accepted offer in green and rejects others.
- [ ] Provider cannot see the "Accept" button.

## Definition of Done
- [ ] Vitest fake DOM tests pass 100%.
- [ ] Clean typecheck and linting.

## Edge cases to handle
- Customer attempts to accept offer that was concurrently accepted by another session: display error banner with message "This request has already been accepted".

## Pre-flight check
Confirm `FEAT-003-BE-offers.md` is verified.

## What's next
- `FEAT-003-INT-offers-realtime.md` and `FEAT-003-VERIFY-offers.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
