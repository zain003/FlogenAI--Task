# FEAT-003-BE — Offers & Concurrency-Guarded Acceptance (P0)

**Layer**: Backend  
**Goal**: Allow Providers to submit offers on open requests, and enable Customers to accept exactly ONE offer under strict distributed locking and atomic database safety.

## Depends on
`FEAT-002-VERIFY-requests.md`, `000-shared-contracts.md`, `000-nonfunctional-contracts.md`

## Context pack
```typescript
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface OfferEntity {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  message: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferDto {
  price: number;
  message: string;
}
```

## Consumes
```typescript
GET /api/requests/:id (param: id) => Promise<ServiceRequestEntity>
```

## Provides / Exposes
```typescript
POST /api/requests/:id/offers (auth: Provider, body: CreateOfferDto) => Promise<OfferEntity>
GET  /api/requests/:id/offers (param: id) => Promise<PaginatedResponse<OfferEntity>>
POST /api/offers/:id/accept   (auth: Customer) => Promise<{ success: boolean; offer: OfferEntity; paymentPending: boolean }>
```

## Scope (In)
- Mongoose schema `offers` with compound index on `(requestId, status)`.
- Provider submission of offers on requests with status `OPEN`.
- Pricing validation: price > 0, message length 5-1000 chars.
- Customer acceptance of an offer:
  1. Acquire Redis distributed lock `mkt:lock:request:<requestId>` with 10s TTL.
  2. Verify request ownership (`request.customerId === req.user.id`).
  3. Execute atomic MongoDB conditional update `findOneAndUpdate({ _id: requestId, status: 'OPEN' }, { $set: { status: 'ACCEPTED', acceptedOfferId: offerId } })`.
  4. Transition chosen offer status to `ACCEPTED` and all remaining offers to `REJECTED`.
  5. Release Redis lock via atomic Lua script.
  6. Return HTTP 409 Conflict if lock cannot be acquired or if request is already accepted.

## Scope (Out)
- Real-time WebSocket notifications (`FEAT-003-INT`).
- Stripe payment capture (`FEAT-004-BE`).

## Tech / files to touch
- `apps/backend/src/modules/offers/offers.controller.ts`
- `apps/backend/src/modules/offers/offers.service.ts`
- `apps/backend/src/modules/offers/schemas/offer.schema.ts`
- `apps/backend/src/modules/redis/distributed-lock.service.ts`

## Nonfunctional requirements
- Concurrency: Zero double-acceptances under parallel asynchronous load.
- Lock timeout: 10,000ms TTL to prevent permanent deadlock if a worker dies.
- Atomic lock release: verify ownership token using Lua script before deleting key.

## Tests to write FIRST
1. `should allow authenticated provider to submit offer on open request`
2. `should reject offer submission on closed or accepted request with HTTP 400`
3. `should allow customer who owns request to accept an offer with HTTP 200`
4. `should reject offer acceptance by a user who does not own the request with HTTP 403`
5. `CONCURRENCY RACE TEST: should reject simultaneous double-acceptance attempts with HTTP 409 and accept exactly ONE offer`
6. `should mark unaccepted offers as REJECTED upon successful acceptance`

## Implementation steps
1. Implement `DistributedLockService` with `acquire(key, ttl)` and `release(key, token)`.
2. Define `OfferSchema` with indexed `requestId`, `providerId`, `status`.
3. Implement `OffersService.createOffer`: verify request exists and is `OPEN`; persist offer with status `PENDING`.
4. Implement `OffersService.acceptOffer`:
   - Acquire Redis lock on request ID.
   - Fetch request and check customer ownership.
   - Atomically update request status from `OPEN` to `ACCEPTED`.
   - Update offer status to `ACCEPTED` and peer offers to `REJECTED`.
   - Release Redis lock in `finally` block.
5. Create `OffersController` with guards and route handlers.

## Acceptance criteria
- [ ] Provider creates offer with valid price and receives HTTP 201.
- [ ] Attempting to accept an already-accepted request returns HTTP 409 Conflict.
- [ ] Parallel concurrent acceptance calls result in exactly 1 HTTP 200 and 1+ HTTP 409.
- [ ] Only the request owner can trigger acceptance (others receive HTTP 403).

## Definition of Done
- [ ] Parallel concurrency test passes with 0 double-acceptances.
- [ ] Unit and API tests pass 100%.
- [ ] Test report generated in `feature-test-reports/FEAT-003-test-report.md`.

## Edge cases to handle
- Redis crash or partition: MongoDB atomic conditional check acts as secondary fallback barrier.
- Customer accepting an offer that was deleted or doesn't belong to the request (reject with HTTP 400).

## Pre-flight check
Confirm `FEAT-002-VERIFY-requests.md` is verified and green.

## What's next
- `FEAT-003-FE-offers.md` and `FEAT-003-INT-offers-realtime.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
