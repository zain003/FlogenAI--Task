---
name: verify-concurrency
description: >-
  Use this skill when implementing, testing, or verifying concurrency control, distributed locking with Redis, and double-acceptance prevention in FEAT-003 or EPIC-001.
---

# Concurrency & Distributed Lock Verification Runbook

This skill guides the implementation and verification of the mandatory Concurrency Challenge: preventing double-acceptance of offers when concurrent requests hit different NestJS backend instances.

## Architecture Pattern: Two-Tier Concurrency Guard

To guarantee safety even under network partitions or Redis failovers, use two layers of protection:

```
[Incoming Accept Request]
         │
         ▼
Tier 1: Redis Distributed Lock (mkt:lock:request:<requestId>)
  - Command: SET mkt:lock:request:<id> <randomToken> NX EX 10
  - If null returned => Lock not acquired => Reject immediately with HTTP 409 Conflict
         │ (Lock acquired)
         ▼
Tier 2: MongoDB Conditional Atomic Mutation
  - Query: findOneAndUpdate(
      { _id: requestId, status: 'OPEN' },
      { $set: { status: 'ACCEPTED', acceptedOfferId: offerId } },
      { new: true }
    )
  - If null returned => Request already accepted by another instance => Reject with HTTP 409 Conflict
         │ (Updated successfully)
         ▼
  - Update winning offer status: 'ACCEPTED'
  - Update peer offers on request: 'REJECTED'
         │
         ▼
Finally Block: Release Redis Lock via Lua Script
  - KEYS[1] = lockKey, ARGV[1] = randomToken
  - if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end
```

## Writing the Automated Race Condition Test

Create an integration test in `apps/backend/test/concurrency.e2e-spec.ts`:

```typescript
describe('Offer Acceptance Concurrency Race Condition', () => {
  it('should accept exactly ONE offer and reject concurrent requests with HTTP 409', async () => {
    // 1. Seed Customer, Provider 1, Provider 2, and Request in OPEN state
    const customer = await seedUser('customer');
    const provider1 = await seedUser('provider');
    const provider2 = await seedUser('provider');
    const request = await seedRequest(customer.id, 'OPEN');

    // 2. Seed 2 competing offers
    const offer1 = await seedOffer(request.id, provider1.id, 200);
    const offer2 = await seedOffer(request.id, provider2.id, 250);

    // 3. Fire parallel simultaneous acceptance requests at the exact same millisecond
    const [res1, res2] = await Promise.all([
      requestApp(app1).post(`/api/offers/${offer1.id}/accept`).set('Authorization', `Bearer ${customer.token}`),
      requestApp(app2).post(`/api/offers/${offer2.id}/accept`).set('Authorization', `Bearer ${customer.token}`),
    ]);

    // 4. Assert that exactly ONE succeeded and the other was rejected
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // 5. Verify database consistency
    const updatedRequest = await requestModel.findById(request.id);
    expect(updatedRequest.status).toBe('ACCEPTED');

    const acceptedOffers = await offerModel.find({ requestId: request.id, status: 'ACCEPTED' });
    expect(acceptedOffers.length).toBe(1);

    const rejectedOffers = await offerModel.find({ requestId: request.id, status: 'REJECTED' });
    expect(rejectedOffers.length).toBe(1);
  });
});
```

## Failure Scenarios to Defend Against

1. **Redis Node Failure**: If Redis crashes mid-operation, the TTL (10s) expires automatically to prevent deadlocks; MongoDB conditional update ensures zero double-acceptances even if Redis is bypassed.
2. **Slow Worker Holding Lock**: The Lua script check guarantees that Worker A will never accidentally delete a lock acquired by Worker B if Worker A's lock TTL expired before its unlock call.
