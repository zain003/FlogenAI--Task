# FEAT-003-INT — Real-Time Offer Events & Acceptance Broadcast (P0)

**Layer**: Integration  
**Goal**: Emit real-time Socket.IO events across Redis when offers are created and accepted, notifying counterparties instantly.

## Depends on
`FEAT-003-BE-offers.md`, `FEAT-002-INT-requests-realtime.md`, `000-shared-contracts.md`

## Context pack
```typescript
export interface ServerToClientEvents {
  'offer:created': (payload: { offer: OfferEntity; requestTitle: string }) => void;
  'offer:accepted': (payload: { offer: OfferEntity; requestId: string }) => void;
  'request:closed': (payload: { requestId: string }) => void;
}
```

## Consumes
```typescript
POST /api/requests/:id/offers (body: CreateOfferDto) => Promise<OfferEntity>
POST /api/offers/:id/accept   (param: id) => Promise<{ success: boolean; offer: OfferEntity }>
```

## Provides / Exposes
```typescript
// Socket.IO Events & Targeted Rooms
Room: "user:<customerId>" => Event: "offer:created"
Room: "user:<providerId>" => Event: "offer:accepted"
Room: "providers"         => Event: "request:closed"
```

## Scope (In)
- User private room auto-join on connection (`user:<userId>`).
- Dispatching `offer:created` directly to customer room when provider submits offer.
- Dispatching `offer:accepted` directly to winning provider room when accepted.
- Dispatching `request:closed` to general `providers` room so open request feeds remove/disable it.
- Frontend listeners updating offer list and request status live without page refresh.

## Scope (Out)
- Chat room lifecycle (`FEAT-005-INT`).

## Tech / files to touch
- `apps/backend/src/modules/socket/socket.gateway.ts`
- `apps/backend/src/modules/offers/offers.service.ts`
- `apps/frontend/src/app/requests/[id]/page.tsx`
- `apps/frontend/src/app/provider/browse/page.tsx`

## Event delivery & failure contract
- **Delivery Guarantee**: At-least-once across cluster via Redis Pub/Sub adapter.
- **Idempotency Mechanism**: Client updates matching offer ID or appends if new; duplicate events are no-ops.
- **Failure Behavior**: Socket delivery failure does not roll back the database transaction; state is reconcilable on next page load or polling.

## Tests to write FIRST
1. `should emit offer:created to customer personal room when offer is posted`
2. `should emit offer:accepted to selected provider room when offer is accepted`
3. `should broadcast request:closed to providers room when offer is accepted`
4. `should propagate offer events across two NestJS instances via Redis adapter`

## Implementation steps
1. In `MarketplaceGateway.handleConnection`, join socket to room `user:<userId>`.
2. In `OffersService.createOffer`, emit `offer:created` to `user:<customerId>`.
3. In `OffersService.acceptOffer`, emit `offer:accepted` to `user:<providerId>` and `request:closed` to `"providers"`.
4. In frontend Request Detail view, listen for `offer:created` and prepend to list with highlight animation.
5. In frontend Provider Browse view, listen for `request:closed` and mark request closed.

## Acceptance criteria
- [ ] Customer viewing request details sees incoming offer appear in real time (< 200ms).
- [ ] Winning provider receives immediate alert banner indicating acceptance.
- [ ] Other providers see request status update to closed.

## Definition of Done
- [ ] Multi-instance socket integration tests pass.
- [ ] Test report generated in `feature-test-reports/FEAT-003-test-report.md`.

## Edge cases to handle
- Customer disconnected during offer submission: offer is persisted in MongoDB and appears when customer reconnects.

## Pre-flight check
Confirm `FEAT-003-BE-offers.md` is verified.

## What's next
- `FEAT-003-VERIFY-offers.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
