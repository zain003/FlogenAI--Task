import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { Payment } from './schemas/payment.schema';
import { ProcessedEvent } from './schemas/processed-event.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { ServiceRequest } from '../requests/schemas/service-request.schema';
import { MarketplaceGateway } from '../socket/socket.gateway';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

describe('Stripe Webhook Verification & Idempotency Engine Suite', () => {
  let app: INestApplication;
  let paymentsService: PaymentsService;

  const webhookSecret = 'whsec_test_secret_key_12345';
  const paymentIntentId = 'pi_test_live_intent_999';
  const requestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const offerId = '65f2b2b2b2b2b2b2b2b2b2b2';
  const customerId = '507f1f77bcf86cd799439011';
  const providerId = '507f1f77bcf86cd799439022';
  const amountCents = 25000;

  // In-memory persistent database simulator for state assertions
  let processedEventsStore: Map<string, any>;
  let paymentsStore: Map<string, any>;
  let serviceRequestsStore: Map<string, any>;
  let offersStore: Map<string, any>;

  let mockGateway: any;
  let mockStripeService: any;

  // Stripe signature generation utility
  const generateStripeSignature = (payload: string, secret: string): string => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  };

  const generateMockStripeEvent = (
    eventId: string,
    type: string,
    piId: string,
    amount: number = amountCents,
  ) => {
    return JSON.stringify({
      id: eventId,
      object: 'event',
      api_version: '2025-01-27.acacia',
      created: Math.floor(Date.now() / 1000),
      type,
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount,
          currency: 'usd',
          status: type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
          metadata: {
            requestId,
            offerId,
            customerId,
            providerId,
          },
        },
      },
    });
  };

  beforeAll(async () => {
    processedEventsStore = new Map();
    paymentsStore = new Map();
    serviceRequestsStore = new Map();
    offersStore = new Map();

    const mockPaymentModel: any = jest.fn().mockImplementation((dto) => {
      const doc: any = {
        ...dto,
        _id: 'payment_' + Date.now(),
        id: 'payment_' + Date.now(),
      };
      doc.save = jest.fn().mockImplementation(async function (this: any) {
        paymentsStore.set(this.stripePaymentIntentId, this);
        return this;
      });
      paymentsStore.set(doc.stripePaymentIntentId, doc);
      return doc;
    });
    mockPaymentModel.findOne = jest.fn().mockImplementation(({ stripePaymentIntentId, requestId: rId }) => {
      if (stripePaymentIntentId) {
        return paymentsStore.get(stripePaymentIntentId) || null;
      }
      if (rId) {
        for (const p of paymentsStore.values()) {
          if (p.requestId === rId) return p;
        }
      }
      return null;
    });
    mockPaymentModel.find = jest.fn().mockImplementation(({ stripePaymentIntentId }) => {
      const match = paymentsStore.get(stripePaymentIntentId);
      return match ? [match] : [];
    });
    mockPaymentModel.create = jest.fn().mockImplementation((dto) => {
      const doc: any = {
        ...dto,
        _id: 'payment_' + Date.now(),
        id: 'payment_' + Date.now(),
      };
      doc.save = jest.fn().mockImplementation(async function (this: any) {
        paymentsStore.set(this.stripePaymentIntentId, this);
        return this;
      });
      paymentsStore.set(doc.stripePaymentIntentId, doc);
      return doc;
    });

    const mockProcessedEventModel: any = {
      findById: jest.fn().mockImplementation((id: string) => {
        return processedEventsStore.get(id) || null;
      }),
      find: jest.fn().mockImplementation(({ _id }) => {
        const item = processedEventsStore.get(_id);
        return item ? [item] : [];
      }),
      create: jest.fn().mockImplementation((dto: any) => {
        if (processedEventsStore.has(dto._id)) {
          const err: any = new Error('E11000 duplicate key error collection');
          err.code = 11000;
          throw err;
        }
        processedEventsStore.set(dto._id, dto);
        return dto;
      }),
    };

    const mockOfferModel: any = {
      findById: jest.fn().mockImplementation((id: string) => offersStore.get(id) || null),
    };

    const mockRequestModel: any = {
      findById: jest.fn().mockImplementation((id: string) => serviceRequestsStore.get(id) || null),
      findByIdAndUpdate: jest
        .fn()
        .mockImplementation((id: string, update: any) => {
          const req = serviceRequestsStore.get(id);
          if (req && update.$set) {
            Object.assign(req, update.$set);
            serviceRequestsStore.set(id, req);
          }
          return req;
        }),
    };

    mockGateway = {
      emitPaymentSucceeded: jest.fn(),
    };

    mockStripeService = {
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: paymentIntentId,
        client_secret: `${paymentIntentId}_secret`,
        amount: amountCents,
        currency: 'usd',
      }),
      constructWebhookEvent: jest.fn().mockImplementation((rawPayload, signature) => {
        if (!signature || signature.includes('invalid')) {
          throw new Error('Webhook signature verification failed');
        }
        const str = Buffer.isBuffer(rawPayload)
          ? rawPayload.toString('utf8')
          : typeof rawPayload === 'string'
            ? rawPayload
            : JSON.stringify(rawPayload);
        return JSON.parse(str);
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        { provide: StripeService, useValue: mockStripeService },
        { provide: MarketplaceGateway, useValue: mockGateway },
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        {
          provide: getModelToken(ProcessedEvent.name),
          useValue: mockProcessedEventModel,
        },
        { provide: getModelToken(Offer.name), useValue: mockOfferModel },
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
      ],
    }).compile();

    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    processedEventsStore.clear();
    paymentsStore.clear();
    serviceRequestsStore.clear();
    offersStore.clear();
    jest.clearAllMocks();

    // Populate initial state: Request is ACCEPTED, Offer is ACCEPTED, Payment is PENDING
    serviceRequestsStore.set(requestId, {
      _id: requestId,
      id: requestId,
      title: 'Plumbing Emergency Service',
      customerId,
      status: 'ACCEPTED',
      acceptedOfferId: offerId,
    });

    offersStore.set(offerId, {
      _id: offerId,
      id: offerId,
      requestId,
      providerId,
      price: 250,
      status: 'ACCEPTED',
    });

    paymentsStore.set(paymentIntentId, {
      _id: 'payment_init_1',
      id: 'payment_init_1',
      requestId,
      offerId,
      customerId,
      providerId,
      amount: amountCents,
      currency: 'usd',
      status: 'PENDING',
      stripePaymentIntentId: paymentIntentId,
      save: jest.fn().mockImplementation(async function (this: any) {
        paymentsStore.set(this.stripePaymentIntentId, this);
        return this;
      }),
    });
  });

  // ─── Test 1: Invalid Signature Rejection ─────────────────────────────────

  it('should reject webhook call with invalid signature with HTTP 400', async () => {
    const eventId = 'evt_test_invalid_sig';
    const payload = generateMockStripeEvent(eventId, 'payment_intent.succeeded', paymentIntentId);
    const invalidSignature = 't=12345,v1=invalid_hmac_hash';

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', invalidSignature)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid Stripe webhook signature');

    // Confirm zero database mutations
    expect(processedEventsStore.size).toBe(0);
    expect(paymentsStore.get(paymentIntentId).status).toBe('PENDING');
    expect(serviceRequestsStore.get(requestId).status).toBe('ACCEPTED');
  });

  // ─── Test 2: Valid Delivery Updates Payment to SUCCEEDED and Request to PAID ─

  it('should update payment to SUCCEEDED and request to PAID on payment_intent.succeeded', async () => {
    const eventId = 'evt_test_valid_success';
    const payload = generateMockStripeEvent(eventId, 'payment_intent.succeeded', paymentIntentId);
    const signature = generateStripeSignature(payload, webhookSecret);

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    // Payment must be SUCCEEDED
    const payment = paymentsStore.get(paymentIntentId);
    expect(payment.status).toBe('SUCCEEDED');

    // Service request must be PAID
    const requestEntity = serviceRequestsStore.get(requestId);
    expect(requestEntity.status).toBe('PAID');

    // Event must be recorded in processed_events
    expect(processedEventsStore.has(eventId)).toBe(true);

    // Socket notification must be dispatched to customer and provider
    expect(mockGateway.emitPaymentSucceeded).toHaveBeenCalledWith(
      customerId,
      providerId,
      requestId,
      amountCents,
    );
  });

  // ─── Test 3: Failed Payment Updates Payment Status to FAILED ─────────────

  it('should update payment to FAILED on payment_intent.payment_failed', async () => {
    const eventId = 'evt_test_valid_failed';
    const payload = generateMockStripeEvent(eventId, 'payment_intent.payment_failed', paymentIntentId);
    const signature = generateStripeSignature(payload, webhookSecret);

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    // Payment must be FAILED
    const payment = paymentsStore.get(paymentIntentId);
    expect(payment.status).toBe('FAILED');

    // Service request status remains unchanged (still ACCEPTED, awaiting payment)
    const requestEntity = serviceRequestsStore.get(requestId);
    expect(requestEntity.status).toBe('ACCEPTED');

    // Event must be recorded
    expect(processedEventsStore.has(eventId)).toBe(true);
    expect(mockGateway.emitPaymentSucceeded).not.toHaveBeenCalled();
  });

  // ─── Test 4: Webhook Idempotency Suite (Replaying Event 3 Times) ──────────

  it('WEBHOOK IDEMPOTENCY TEST: should handle duplicate webhook events without double-updating database', async () => {
    const eventId = 'evt_test_replay_' + Date.now();
    const payload = generateMockStripeEvent(eventId, 'payment_intent.succeeded', paymentIntentId);
    const signature = generateStripeSignature(payload, webhookSecret);

    // Delivery 1: Initial event delivery
    const res1 = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({ received: true });

    // Assert database updated to PAID
    expect(paymentsStore.get(paymentIntentId).status).toBe('SUCCEEDED');
    expect(serviceRequestsStore.get(requestId).status).toBe('PAID');
    expect(mockGateway.emitPaymentSucceeded).toHaveBeenCalledTimes(1);

    // Delivery 2: Replay delivery (duplicate)
    const res2 = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ received: true });

    // Delivery 3: Third replay (duplicate)
    const res3 = await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res3.status).toBe(200);
    expect(res3.body).toEqual({ received: true });

    // Strict Idempotency Assertions:
    // 1. processed_events has EXACTLY 1 entry for this event ID
    expect(processedEventsStore.has(eventId)).toBe(true);
    expect(processedEventsStore.size).toBe(1);

    // 2. payments store has exactly 1 record and state remained SUCCEEDED
    expect(paymentsStore.size).toBe(1);
    expect(paymentsStore.get(paymentIntentId).status).toBe('SUCCEEDED');

    // 3. Socket broadcast occurred strictly ONCE across all 3 deliveries
    expect(mockGateway.emitPaymentSucceeded).toHaveBeenCalledTimes(1);
  });
});
