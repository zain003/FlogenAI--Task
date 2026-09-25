import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { OffersService } from './offers.service';
import { Offer } from './schemas/offer.schema';
import { ServiceRequest } from '../requests/schemas/service-request.schema';
import { DistributedLockService } from '../redis/distributed-lock.service';
import { RedisService } from '../redis/redis.service';
import { MarketplaceGateway } from '../socket/socket.gateway';

describe('Offers Concurrency & Distributed Lock Race Condition Tests', () => {
  let service: OffersService;
  let lockService: DistributedLockService;

  const customerId = '507f1f77bcf86cd799439011';
  const provider1Id = '507f1f77bcf86cd799439021';
  const provider2Id = '507f1f77bcf86cd799439022';
  const provider3Id = '507f1f77bcf86cd799439023';

  const requestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const offer1Id = '65f2b2b2b2b2b2b2b2b2b2b1';
  const offer2Id = '65f2b2b2b2b2b2b2b2b2b2b2';
  const offer3Id = '65f2b2b2b2b2b2b2b2b2b2b3';

  // In-memory atomic data store simulating MongoDB collections
  let dbRequests: Map<string, any>;
  let dbOffers: Map<string, any>;

  beforeEach(async () => {
    // Reset database state before each race test
    dbRequests = new Map();
    dbOffers = new Map();

    dbRequests.set(requestId, {
      _id: requestId,
      title: 'Plumbing Emergency',
      description: 'Leaking water main in basement.',
      budget: 500,
      status: 'OPEN',
      customerId,
      acceptedOfferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    dbOffers.set(offer1Id, {
      _id: offer1Id,
      requestId,
      providerId: provider1Id,
      price: 450,
      message: 'Provider 1 bid',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    dbOffers.set(offer2Id, {
      _id: offer2Id,
      requestId,
      providerId: provider2Id,
      price: 420,
      message: 'Provider 2 bid',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    dbOffers.set(offer3Id, {
      _id: offer3Id,
      requestId,
      providerId: provider3Id,
      price: 400,
      message: 'Provider 3 bid',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Stateful Mock Request Model with atomic findOneAndUpdate
    const mockRequestModel: any = {
      findById: jest.fn().mockImplementation((id: string) => ({
        exec: jest.fn().mockImplementation(async () => {
          const doc = dbRequests.get(id);
          return doc ? { ...doc } : null;
        }),
      })),

      // Atomic conditional update simulation: findOneAndUpdate({ _id, status: 'OPEN' })
      findOneAndUpdate: jest.fn().mockImplementation((filter: any, update: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          const doc = dbRequests.get(filter._id);
          if (!doc) return null;
          // Condition: must match filter.status
          if (filter.status && doc.status !== filter.status) {
            return null; // Atomic check failed: status is not OPEN
          }

          // Apply update
          if (update.$set) {
            Object.assign(doc, update.$set, { updatedAt: new Date() });
          }
          dbRequests.set(filter._id, doc);
          return { ...doc };
        }),
      })),
    };

    // Stateful Mock Offer Model
    const mockOfferModel: any = {
      findById: jest.fn().mockImplementation((id: string) => ({
        exec: jest.fn().mockImplementation(async () => {
          const doc = dbOffers.get(id);
          return doc ? { ...doc } : null;
        }),
      })),

      findByIdAndUpdate: jest.fn().mockImplementation((id: string, update: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          const doc = dbOffers.get(id);
          if (!doc) return null;
          if (update.$set) {
            Object.assign(doc, update.$set, { updatedAt: new Date() });
          }
          dbOffers.set(id, doc);
          return { ...doc };
        }),
      })),

      updateMany: jest.fn().mockImplementation((filter: any, update: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          let count = 0;
          for (const [id, doc] of dbOffers.entries()) {
            if (doc.requestId === filter.requestId) {
              if (filter._id?.$ne && id === filter._id.$ne) {
                continue;
              }
              if (filter.status && doc.status !== filter.status) {
                continue;
              }
              if (update.$set) {
                Object.assign(doc, update.$set, { updatedAt: new Date() });
              }
              dbOffers.set(id, doc);
              count++;
            }
          }
          return { modifiedCount: count };
        }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        DistributedLockService,
        {
          provide: RedisService,
          useValue: {
            isReady: jest.fn().mockReturnValue(false), // uses in-memory distributed lock engine
            getClient: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: getModelToken(Offer.name),
          useValue: mockOfferModel,
        },
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
        {
          // No-op mock: concurrency tests verify DB-level race safety, not event dispatch
          provide: MarketplaceGateway,
          useValue: {
            emitOfferCreated: jest.fn(),
            emitOfferAccepted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    lockService = module.get<DistributedLockService>(DistributedLockService);
  });

  it('CONCURRENCY RACE TEST: should reject simultaneous double-acceptance attempts with HTTP 409 and accept exactly ONE offer', async () => {
    // Fire 2 parallel simultaneous acceptance requests at the exact same millisecond
    const results = await Promise.allSettled([
      service.acceptOffer(offer1Id, customerId),
      service.acceptOffer(offer2Id, customerId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // ASSERTION 1: Exactly ONE succeeds and ONE is rejected with ConflictException (HTTP 409)
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(ConflictException);

    // ASSERTION 2: Database integrity check - Service Request state
    const finalRequest = dbRequests.get(requestId);
    expect(finalRequest.status).toBe('ACCEPTED');
    expect([offer1Id, offer2Id]).toContain(finalRequest.acceptedOfferId);

    // ASSERTION 3: Exactly ONE offer is ACCEPTED in database
    const acceptedOffers = Array.from(dbOffers.values()).filter(
      (o) => o.status === 'ACCEPTED',
    );
    expect(acceptedOffers).toHaveLength(1);
    expect(acceptedOffers[0]._id).toBe(finalRequest.acceptedOfferId);

    // ASSERTION 4: should mark unaccepted offers as REJECTED upon successful acceptance
    const rejectedOffers = Array.from(dbOffers.values()).filter(
      (o) => o.status === 'REJECTED',
    );
    // Out of the 3 seeded offers, the other 2 must now be REJECTED
    expect(rejectedOffers).toHaveLength(2);
  });

  it('CONCURRENCY STRESS TEST: should handle 5 simultaneous parallel acceptance attempts with 0 double-acceptances', async () => {
    // Seed 2 more offers
    const offer4Id = '65f2b2b2b2b2b2b2b2b2b2b4';
    const offer5Id = '65f2b2b2b2b2b2b2b2b2b2b5';
    dbOffers.set(offer4Id, {
      _id: offer4Id,
      requestId,
      providerId: '507f1f77bcf86cd799439024',
      price: 390,
      message: 'Provider 4 bid',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbOffers.set(offer5Id, {
      _id: offer5Id,
      requestId,
      providerId: '507f1f77bcf86cd799439025',
      price: 380,
      message: 'Provider 5 bid',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const offerIds = [offer1Id, offer2Id, offer3Id, offer4Id, offer5Id];

    // Fire all 5 acceptance requests concurrently
    const results = await Promise.allSettled(
      offerIds.map((id) => service.acceptOffer(id, customerId)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // ASSERTION: Exactly 1 success, 4 rejected
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    rejected.forEach((r) => {
      const err = (r as PromiseRejectedResult).reason;
      expect(err).toBeInstanceOf(ConflictException);
    });

    // Verify only ONE offer is ACCEPTED in DB
    const acceptedOffers = Array.from(dbOffers.values()).filter(
      (o) => o.status === 'ACCEPTED',
    );
    expect(acceptedOffers).toHaveLength(1);

    // All remaining 4 offers must be REJECTED
    const rejectedOffers = Array.from(dbOffers.values()).filter(
      (o) => o.status === 'REJECTED',
    );
    expect(rejectedOffers).toHaveLength(4);

    // Request is accepted
    const req = dbRequests.get(requestId);
    expect(req.status).toBe('ACCEPTED');
    expect(req.acceptedOfferId).toBe(acceptedOffers[0]._id);
  });

  it('DEFENSE-IN-DEPTH TEST: Tier 2 MongoDB atomic check prevents double acceptance even if lock is bypassed', async () => {
    // Temporarily bypass Tier 1 lock (mock lock to always return token)
    jest.spyOn(lockService, 'acquire').mockResolvedValue('bypassed-token');

    // Fire 2 parallel acceptance calls without lock mutual exclusion
    const results = await Promise.allSettled([
      service.acceptOffer(offer1Id, customerId),
      service.acceptOffer(offer2Id, customerId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Even without the Redis lock, MongoDB's atomic findOneAndUpdate({ status: 'OPEN' })
    // guarantees that exactly ONE succeeds and the other receives ConflictException
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );

    const acceptedOffers = Array.from(dbOffers.values()).filter(
      (o) => o.status === 'ACCEPTED',
    );
    expect(acceptedOffers).toHaveLength(1);
  });
});
