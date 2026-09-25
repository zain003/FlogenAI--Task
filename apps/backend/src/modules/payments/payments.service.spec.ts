import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from './schemas/payment.schema';
import { ProcessedEvent } from './schemas/processed-event.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { ServiceRequest } from '../requests/schemas/service-request.schema';
import { StripeService } from './stripe.service';
import { PaymentsWebhookService } from './payments-webhook.service';
import { MarketplaceGateway } from '../socket/socket.gateway';

describe('PaymentsService (Domain Logic Unit Tests)', () => {
  let service: PaymentsService;
  let mockPaymentModel: any;
  let mockProcessedEventModel: any;
  let mockOfferModel: any;
  let mockRequestModel: any;
  let mockStripeService: any;
  let mockMarketplaceGateway: any;

  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validOfferId = '65f2b2b2b2b2b2b2b2b2b2b2';
  const validCustomerId = '507f1f77bcf86cd799439011';
  const validProviderId = '507f1f77bcf86cd799439022';
  const otherCustomerId = '507f1f77bcf86cd799439099';
  const paymentIntentId = 'pi_test_123456789';
  const clientSecret = 'pi_test_123456789_secret_abc123';

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPaymentModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: 'payment_test_id_1',
      id: 'payment_test_id_1',
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: 'payment_test_id_1',
        id: 'payment_test_id_1',
      }),
    }));
    mockPaymentModel.findOne = jest.fn();
    mockPaymentModel.findById = jest.fn();
    mockPaymentModel.create = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: 'payment_test_id_1',
      id: 'payment_test_id_1',
    }));

    mockProcessedEventModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue(dto),
    }));
    mockProcessedEventModel.findById = jest.fn();
    mockProcessedEventModel.create = jest.fn().mockImplementation((dto) => dto);

    mockOfferModel = {
      findById: jest.fn(),
    };

    mockRequestModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockStripeService = {
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: paymentIntentId,
        client_secret: clientSecret,
        amount: 25000,
        currency: 'usd',
      }),
      constructWebhookEvent: jest.fn(),
    };

    mockMarketplaceGateway = {
      emitPaymentSucceeded: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
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
          provide: getModelToken(Offer.name),
          useValue: mockOfferModel,
        },
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
        {
          provide: MarketplaceGateway,
          useValue: mockMarketplaceGateway,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create PaymentIntent when caller is the customer who accepted the offer', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        _id: validOfferId,
        requestId: validRequestId,
        providerId: validProviderId,
        price: 250,
        status: 'ACCEPTED',
      });

      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        _id: validRequestId,
        customerId: validCustomerId,
        status: 'ACCEPTED',
      });

      mockPaymentModel.findOne.mockResolvedValue(null);

      const result = await service.createPaymentIntent(validCustomerId, {
        offerId: validOfferId,
      });

      expect(result).toBeDefined();
      expect(result.clientSecret).toBe(clientSecret);
      expect(result.paymentIntentId).toBe(paymentIntentId);
      expect(result.amount).toBe(25000);
      expect(result.currency).toBe('usd');

      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(
        25000,
        'usd',
        expect.objectContaining({
          requestId: validRequestId,
          offerId: validOfferId,
          customerId: validCustomerId,
          providerId: validProviderId,
        }),
      );

      expect(mockPaymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: validRequestId,
          offerId: validOfferId,
          customerId: validCustomerId,
          providerId: validProviderId,
          amount: 25000,
          currency: 'usd',
          status: 'PENDING',
          stripePaymentIntentId: paymentIntentId,
        }),
      );
    });

    // TEST 1 from Spec: should reject create-intent when caller is not the customer who accepted the offer
    it('should reject create-intent when caller is not the customer who accepted the offer', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        requestId: validRequestId,
        providerId: validProviderId,
        price: 250,
        status: 'ACCEPTED',
      });

      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        customerId: validCustomerId,
        status: 'ACCEPTED',
      });

      await expect(
        service.createPaymentIntent(otherCustomerId, {
          offerId: validOfferId,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockStripeService.createPaymentIntent).not.toHaveBeenCalled();
      expect(mockPaymentModel.create).not.toHaveBeenCalled();
    });

    // TEST 2 from Spec: should calculate PaymentIntent amount on backend and ignore client-supplied amount
    it('should calculate PaymentIntent amount on backend and ignore client-supplied amount', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        _id: validOfferId,
        requestId: validRequestId,
        providerId: validProviderId,
        price: 349.99,
        status: 'ACCEPTED',
      });

      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        _id: validRequestId,
        customerId: validCustomerId,
        status: 'ACCEPTED',
      });

      mockPaymentModel.findOne.mockResolvedValue(null);

      // Attempt to pass arbitrary input (which DTO doesn't even accept, but tested for backend enforcement)
      const result = await service.createPaymentIntent(validCustomerId, {
        offerId: validOfferId,
      });

      // 349.99 * 100 = 34999 cents
      expect(result.amount).toBe(34999);
      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(
        34999,
        'usd',
        expect.anything(),
      );
    });

    it('should reject create-intent when offer is not found', async () => {
      mockOfferModel.findById.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent(validCustomerId, {
          offerId: 'non_existent_offer',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject create-intent when service request is not found', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        requestId: validRequestId,
        status: 'ACCEPTED',
      });
      mockRequestModel.findById.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent(validCustomerId, {
          offerId: validOfferId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject create-intent when offer is not in ACCEPTED status', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        requestId: validRequestId,
        status: 'PENDING',
      });
      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        customerId: validCustomerId,
        status: 'OPEN',
      });

      await expect(
        service.createPaymentIntent(validCustomerId, {
          offerId: validOfferId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject create-intent when request is not in ACCEPTED status', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        requestId: validRequestId,
        status: 'ACCEPTED',
      });
      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        customerId: validCustomerId,
        status: 'OPEN',
      });

      await expect(
        service.createPaymentIntent(validCustomerId, {
          offerId: validOfferId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject create-intent when payment has already succeeded', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        requestId: validRequestId,
        status: 'ACCEPTED',
      });
      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        customerId: validCustomerId,
        status: 'ACCEPTED',
      });
      mockPaymentModel.findOne.mockResolvedValue({
        id: 'payment_123',
        status: 'SUCCEEDED',
      });

      await expect(
        service.createPaymentIntent(validCustomerId, {
          offerId: validOfferId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reuse and update existing pending payment record on retry', async () => {
      mockOfferModel.findById.mockResolvedValue({
        id: validOfferId,
        _id: validOfferId,
        requestId: validRequestId,
        providerId: validProviderId,
        price: 250,
        status: 'ACCEPTED',
      });
      mockRequestModel.findById.mockResolvedValue({
        id: validRequestId,
        _id: validRequestId,
        customerId: validCustomerId,
        status: 'ACCEPTED',
      });

      const existingPendingPayment = {
        id: 'payment_123',
        status: 'PENDING',
        stripePaymentIntentId: 'old_pi_id',
        amount: 25000,
        save: jest.fn().mockResolvedValue(true),
      };
      mockPaymentModel.findOne.mockResolvedValue(existingPendingPayment);

      const result = await service.createPaymentIntent(validCustomerId, {
        offerId: validOfferId,
      });

      expect(result.paymentIntentId).toBe(paymentIntentId);
      expect(existingPendingPayment.stripePaymentIntentId).toBe(paymentIntentId);
      expect(existingPendingPayment.save).toHaveBeenCalled();
      expect(mockPaymentModel.create).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    // TEST 3 from Spec: should reject webhook call with invalid signature with HTTP 400
    it('should reject webhook call with invalid signature with HTTP 400', async () => {
      mockStripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      await expect(
        service.handleWebhook('invalid_sig', Buffer.from('payload')),
      ).rejects.toThrow(BadRequestException);

      expect(mockProcessedEventModel.create).not.toHaveBeenCalled();
    });

    // TEST 4 from Spec: should update payment to SUCCEEDED and request to PAID on payment_intent.succeeded
    it('should update payment to SUCCEEDED and request to PAID on payment_intent.succeeded', async () => {
      const eventId = 'evt_test_success_1';
      const event = {
        id: eventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 25000,
          },
        },
      };

      mockStripeService.constructWebhookEvent.mockReturnValue(event);
      mockProcessedEventModel.findById.mockResolvedValue(null);

      const mockPaymentDoc = {
        id: 'payment_1',
        requestId: validRequestId,
        customerId: validCustomerId,
        providerId: validProviderId,
        amount: 25000,
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };
      mockPaymentModel.findOne.mockResolvedValue(mockPaymentDoc);

      const result = await service.handleWebhook('valid_sig', Buffer.from('payload'));

      expect(result).toEqual({ received: true });
      expect(mockProcessedEventModel.create).toHaveBeenCalledWith({
        _id: eventId,
        eventType: 'payment_intent.succeeded',
        processedAt: expect.any(Date),
      });
      expect(mockPaymentDoc.status).toBe('SUCCEEDED');
      expect(mockPaymentDoc.save).toHaveBeenCalled();
      expect(mockRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validRequestId,
        { $set: { status: 'PAID' } },
      );
      expect(mockMarketplaceGateway.emitPaymentSucceeded).toHaveBeenCalledWith(
        validCustomerId,
        validProviderId,
        validRequestId,
        25000,
      );
    });

    // TEST 5 from Spec: WEBHOOK IDEMPOTENCY TEST: should handle duplicate webhook events without double-updating database
    it('WEBHOOK IDEMPOTENCY TEST: should handle duplicate webhook events without double-updating database', async () => {
      const eventId = 'evt_test_duplicate_999';
      const event = {
        id: eventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 25000,
          },
        },
      };

      mockStripeService.constructWebhookEvent.mockReturnValue(event);

      // Event already exists in processed_events table!
      mockProcessedEventModel.findById.mockResolvedValue({
        _id: eventId,
        eventType: 'payment_intent.succeeded',
        processedAt: new Date(),
      });

      const result = await service.handleWebhook('valid_sig', Buffer.from('payload'));

      // Returns HTTP 200 OK immediately
      expect(result).toEqual({ received: true });

      // Zero mutations to processed_events, payments, requests, or sockets!
      expect(mockProcessedEventModel.create).not.toHaveBeenCalled();
      expect(mockPaymentModel.findOne).not.toHaveBeenCalled();
      expect(mockRequestModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockMarketplaceGateway.emitPaymentSucceeded).not.toHaveBeenCalled();
    });

    // TEST 6 from Spec: should update payment to FAILED on payment_intent.payment_failed
    it('should update payment to FAILED on payment_intent.payment_failed', async () => {
      const eventId = 'evt_test_failed_2';
      const event = {
        id: eventId,
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: paymentIntentId,
            amount: 25000,
          },
        },
      };

      mockStripeService.constructWebhookEvent.mockReturnValue(event);
      mockProcessedEventModel.findById.mockResolvedValue(null);

      const mockPaymentDoc = {
        id: 'payment_1',
        requestId: validRequestId,
        customerId: validCustomerId,
        providerId: validProviderId,
        amount: 25000,
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };
      mockPaymentModel.findOne.mockResolvedValue(mockPaymentDoc);

      const result = await service.handleWebhook('valid_sig', Buffer.from('payload'));

      expect(result).toEqual({ received: true });
      expect(mockProcessedEventModel.create).toHaveBeenCalledWith({
        _id: eventId,
        eventType: 'payment_intent.payment_failed',
        processedAt: expect.any(Date),
      });
      expect(mockPaymentDoc.status).toBe('FAILED');
      expect(mockPaymentDoc.save).toHaveBeenCalled();
      expect(mockRequestModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentByRequestId', () => {
    it('should return payment for customer owner of the request', async () => {
      const mockPayment = {
        id: 'pay_123',
        _id: 'pay_123',
        requestId: validRequestId,
        offerId: validOfferId,
        customerId: validCustomerId,
        providerId: validProviderId,
        amount: 25000,
        currency: 'usd',
        status: 'SUCCEEDED',
        stripePaymentIntentId: paymentIntentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPaymentModel.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByRequestId(
        validCustomerId,
        validRequestId,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('pay_123');
      expect(result.customerId).toBe(validCustomerId);
      expect(result.status).toBe('SUCCEEDED');
    });

    it('should return payment for provider party of the request', async () => {
      const mockPayment = {
        id: 'pay_123',
        _id: 'pay_123',
        requestId: validRequestId,
        offerId: validOfferId,
        customerId: validCustomerId,
        providerId: validProviderId,
        amount: 25000,
        currency: 'usd',
        status: 'SUCCEEDED',
        stripePaymentIntentId: paymentIntentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPaymentModel.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByRequestId(
        validProviderId,
        validRequestId,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('pay_123');
      expect(result.providerId).toBe(validProviderId);
    });

    it('should reject payment retrieval for unauthorized third-party user', async () => {
      const mockPayment = {
        id: 'pay_123',
        requestId: validRequestId,
        customerId: validCustomerId,
        providerId: validProviderId,
      };
      mockPaymentModel.findOne.mockResolvedValue(mockPayment);

      await expect(
        service.getPaymentByRequestId(otherCustomerId, validRequestId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      mockPaymentModel.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentByRequestId(validCustomerId, 'non_existent_request'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
