import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaymentsWebhookService } from './payments-webhook.service';
import { Payment } from './schemas/payment.schema';
import { ProcessedEvent } from './schemas/processed-event.schema';
import { ServiceRequest } from '../requests/schemas/service-request.schema';
import { MarketplaceGateway } from '../socket/socket.gateway';
import Stripe from 'stripe';

describe('FEAT-004-INT: PaymentsWebhookService (State Reconciler & Idempotency)', () => {
  let service: PaymentsWebhookService;
  let mockPaymentModel: any;
  let mockProcessedEventModel: any;
  let mockRequestModel: any;
  let mockMarketplaceGateway: any;

  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validCustomerId = '507f1f77bcf86cd799439011';
  const validProviderId = '507f1f77bcf86cd799439022';
  const paymentIntentId = 'pi_test_reconciler_101';
  const amountCents = 35000;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPaymentModel = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockProcessedEventModel = {
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockRequestModel = {
      findByIdAndUpdate: jest.fn(),
    };

    mockMarketplaceGateway = {
      emitPaymentSucceeded: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsWebhookService,
        {
          provide: getModelToken(Payment.name),
          useValue: mockPaymentModel,
        },
        {
          provide: getModelToken(ProcessedEvent.name),
          useValue: mockProcessedEventModel,
        },
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
        {
          provide: MarketplaceGateway,
          useValue: mockMarketplaceGateway,
        },
      ],
    }).compile();

    service = module.get<PaymentsWebhookService>(PaymentsWebhookService);
  });

  const buildStripeEvent = (
    id: string,
    type: string,
    piId: string = paymentIntentId,
  ): Stripe.Event => {
    return {
      id,
      object: 'event',
      api_version: '2025-01-27.acacia',
      created: Math.floor(Date.now() / 1000),
      type,
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: amountCents,
          currency: 'usd',
          status: type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
          metadata: {
            requestId: validRequestId,
            customerId: validCustomerId,
            providerId: validProviderId,
          },
        } as any,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    } as Stripe.Event;
  };

  // TEST 1 from Spec: should process payment_intent.succeeded and transition request to PAID
  it('should process payment_intent.succeeded and transition request to PAID', async () => {
    const event = buildStripeEvent('evt_rec_001', 'payment_intent.succeeded');

    mockProcessedEventModel.findById.mockResolvedValue(null);
    mockProcessedEventModel.create.mockResolvedValue({ _id: 'evt_rec_001' });

    const mockPaymentDoc = {
      id: 'pay_doc_101',
      requestId: validRequestId,
      customerId: validCustomerId,
      providerId: validProviderId,
      amount: amountCents,
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(true),
    };
    mockPaymentModel.findOne.mockResolvedValue(mockPaymentDoc);

    const result = await service.processEvent(event);

    expect(result).toEqual({
      received: true,
      processed: true,
      eventId: 'evt_rec_001',
    });

    // Payment transition
    expect(mockPaymentDoc.status).toBe('SUCCEEDED');
    expect(mockPaymentDoc.save).toHaveBeenCalled();

    // Request transition to PAID
    expect(mockRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
      validRequestId,
      { $set: { status: 'PAID' } },
    );
  });

  // TEST 2 from Spec: should record Stripe event ID in processed_events table
  it('should record Stripe event ID in processed_events table', async () => {
    const event = buildStripeEvent('evt_rec_002', 'payment_intent.succeeded');

    mockProcessedEventModel.findById.mockResolvedValue(null);
    mockProcessedEventModel.create.mockResolvedValue({ _id: 'evt_rec_002' });

    const mockPaymentDoc = {
      id: 'pay_doc_102',
      requestId: validRequestId,
      customerId: validCustomerId,
      providerId: validProviderId,
      amount: amountCents,
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(true),
    };
    mockPaymentModel.findOne.mockResolvedValue(mockPaymentDoc);

    await service.processEvent(event);

    expect(mockProcessedEventModel.create).toHaveBeenCalledWith({
      _id: 'evt_rec_002',
      eventType: 'payment_intent.succeeded',
      processedAt: expect.any(Date),
    });
  });

  // TEST 3 from Spec: should emit payment:succeeded Socket.IO event to customer and provider rooms
  it('should emit payment:succeeded Socket.IO event to customer and provider rooms', async () => {
    const event = buildStripeEvent('evt_rec_003', 'payment_intent.succeeded');

    mockProcessedEventModel.findById.mockResolvedValue(null);
    mockProcessedEventModel.create.mockResolvedValue({ _id: 'evt_rec_003' });

    const mockPaymentDoc = {
      id: 'pay_doc_103',
      requestId: validRequestId,
      customerId: validCustomerId,
      providerId: validProviderId,
      amount: amountCents,
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(true),
    };
    mockPaymentModel.findOne.mockResolvedValue(mockPaymentDoc);

    await service.processEvent(event);

    expect(mockMarketplaceGateway.emitPaymentSucceeded).toHaveBeenCalledWith(
      validCustomerId,
      validProviderId,
      validRequestId,
      amountCents,
    );
  });

  // TEST 4 from Spec: IDEMPOTENCY TEST: should ignore second delivery of same Stripe event ID and emit no extra events
  it('IDEMPOTENCY TEST: should ignore second delivery of same Stripe event ID and emit no extra events', async () => {
    const event = buildStripeEvent('evt_rec_004', 'payment_intent.succeeded');

    // First check finds existing event in processed_events
    mockProcessedEventModel.findById.mockResolvedValue({
      _id: 'evt_rec_004',
      eventType: 'payment_intent.succeeded',
      processedAt: new Date(),
    });

    const result = await service.processEvent(event);

    expect(result).toEqual({
      received: true,
      processed: false,
      eventId: 'evt_rec_004',
    });

    // Zero mutations and zero socket broadcasts on duplicate event
    expect(mockProcessedEventModel.create).not.toHaveBeenCalled();
    expect(mockPaymentModel.findOne).not.toHaveBeenCalled();
    expect(mockRequestModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(mockMarketplaceGateway.emitPaymentSucceeded).not.toHaveBeenCalled();
  });

  // Edge Case: Concurrent insertion duplicate key collision (E11000)
  it('should gracefully handle concurrent parallel delivery with duplicate key collision (E11000)', async () => {
    const event = buildStripeEvent('evt_rec_005', 'payment_intent.succeeded');

    mockProcessedEventModel.findById.mockResolvedValue(null);
    const mongoDuplicateError: any = new Error('E11000 duplicate key error');
    mongoDuplicateError.code = 11000;
    mockProcessedEventModel.create.mockRejectedValue(mongoDuplicateError);

    const result = await service.processEvent(event);

    expect(result).toEqual({
      received: true,
      processed: false,
      eventId: 'evt_rec_005',
    });

    expect(mockPaymentModel.findOne).not.toHaveBeenCalled();
    expect(mockMarketplaceGateway.emitPaymentSucceeded).not.toHaveBeenCalled();
  });

  // Status transition on payment failure
  it('should transition payment status to FAILED on payment_intent.payment_failed', async () => {
    const event = buildStripeEvent('evt_rec_006', 'payment_intent.payment_failed');

    mockProcessedEventModel.findById.mockResolvedValue(null);
    mockProcessedEventModel.create.mockResolvedValue({ _id: 'evt_rec_006' });

    const mockPaymentDoc = {
      id: 'pay_doc_106',
      requestId: validRequestId,
      customerId: validCustomerId,
      providerId: validProviderId,
      amount: amountCents,
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(true),
    };
    mockPaymentModel.findOne.mockResolvedValue(mockPaymentDoc);

    const result = await service.processEvent(event);

    expect(result.processed).toBe(true);
    expect(mockPaymentDoc.status).toBe('FAILED');
    expect(mockPaymentDoc.save).toHaveBeenCalled();
    expect(mockRequestModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(mockMarketplaceGateway.emitPaymentSucceeded).not.toHaveBeenCalled();
  });
});
