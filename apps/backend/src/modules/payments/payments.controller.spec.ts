import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { Reflector } from '@nestjs/core';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PaymentEntity } from './interfaces/payment.interface';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';

describe('PaymentsController (API Layer Contract Tests)', () => {
  let app: INestApplication;

  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validOfferId = '65f2b2b2b2b2b2b2b2b2b2b2';

  const mockCustomer = {
    id: '507f1f77bcf86cd799439011',
    email: 'customer@test.com',
    role: 'customer',
  };

  const mockProvider = {
    id: '507f1f77bcf86cd799439022',
    email: 'provider@test.com',
    role: 'provider',
  };

  const mockPaymentIntentResponse: PaymentIntentResponseDto = {
    clientSecret: 'pi_test_123_secret_456',
    paymentIntentId: 'pi_test_123',
    amount: 30000,
    currency: 'usd',
  };

  const mockPaymentEntity: PaymentEntity = {
    id: '65f3c3c3c3c3c3c3c3c3c3c3',
    requestId: validRequestId,
    offerId: validOfferId,
    customerId: mockCustomer.id,
    providerId: mockProvider.id,
    amount: 30000,
    currency: 'usd',
    status: 'SUCCEEDED',
    stripePaymentIntentId: 'pi_test_123',
    createdAt: '2026-09-25T14:00:00.000Z',
    updatedAt: '2026-09-25T14:05:00.000Z',
  };

  const mockPaymentsService = {
    createPaymentIntent: jest.fn(),
    handleWebhook: jest.fn(),
    getPaymentByRequestId: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        Reflector,
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const authHeader = req.headers['authorization'];
          if (!authHeader) {
            throw new UnauthorizedException('Authentication token required');
          }
          if (authHeader === 'Bearer customer-token') {
            req.user = mockCustomer;
            return true;
          }
          if (authHeader === 'Bearer provider-token') {
            req.user = mockProvider;
            return true;
          }
          throw new UnauthorizedException('Invalid token');
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
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
    jest.clearAllMocks();
  });

  // ─── POST /api/payments/create-intent ──────────────────────────────────────

  describe('POST /api/payments/create-intent', () => {
    it('should allow customer to create PaymentIntent with HTTP 200', async () => {
      mockPaymentsService.createPaymentIntent.mockResolvedValue(
        mockPaymentIntentResponse,
      );

      const res = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer customer-token')
        .send({ offerId: validOfferId });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPaymentIntentResponse);
      expect(mockPaymentsService.createPaymentIntent).toHaveBeenCalledWith(
        mockCustomer.id,
        { offerId: validOfferId },
      );
    });

    it('should return HTTP 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .send({ offerId: validOfferId });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Authentication token required');
      expect(mockPaymentsService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should return HTTP 403 when Provider attempts to create PaymentIntent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer provider-token')
        .send({ offerId: validOfferId });

      expect(res.status).toBe(403);
      expect(mockPaymentsService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should return HTTP 400 when offerId is missing in body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer customer-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should return HTTP 400 when extra non-whitelisted fields are provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer customer-token')
        .send({ offerId: validOfferId, clientAmount: 10 });

      expect(res.status).toBe(400);
    });

    it('should propagate 403 ForbiddenException when customer did not own the request', async () => {
      mockPaymentsService.createPaymentIntent.mockRejectedValue(
        new ForbiddenException(
          'Only the customer who accepted this offer can create a payment intent',
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer customer-token')
        .send({ offerId: validOfferId });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain(
        'Only the customer who accepted this offer can create a payment intent',
      );
    });
  });

  // ─── POST /api/payments/webhook ────────────────────────────────────────────

  describe('POST /api/payments/webhook', () => {
    it('should return HTTP 400 when stripe-signature header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .send({ id: 'evt_123', type: 'payment_intent.succeeded' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Missing stripe-signature header');
      expect(mockPaymentsService.handleWebhook).not.toHaveBeenCalled();
    });

    it('should return HTTP 400 when signature verification fails', async () => {
      mockPaymentsService.handleWebhook.mockRejectedValue(
        new BadRequestException('Invalid Stripe webhook signature: signature mismatch'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'invalid_signature_str')
        .send({ id: 'evt_123', type: 'payment_intent.succeeded' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid Stripe webhook signature');
    });

    it('should process webhook and return HTTP 200 on valid signature', async () => {
      mockPaymentsService.handleWebhook.mockResolvedValue({ received: true });

      const res = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'valid_test_signature')
        .send({ id: 'evt_123', type: 'payment_intent.succeeded' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(mockPaymentsService.handleWebhook).toHaveBeenCalled();
    });
  });

  // ─── GET /api/payments/by-request/:id ──────────────────────────────────────

  describe('GET /api/payments/by-request/:id', () => {
    it('should return payment entity for authenticated customer', async () => {
      mockPaymentsService.getPaymentByRequestId.mockResolvedValue(
        mockPaymentEntity,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/payments/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer customer-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPaymentEntity);
      expect(mockPaymentsService.getPaymentByRequestId).toHaveBeenCalledWith(
        mockCustomer.id,
        validRequestId,
      );
    });

    it('should return payment entity for authenticated provider', async () => {
      mockPaymentsService.getPaymentByRequestId.mockResolvedValue(
        mockPaymentEntity,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/payments/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer provider-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPaymentEntity);
      expect(mockPaymentsService.getPaymentByRequestId).toHaveBeenCalledWith(
        mockProvider.id,
        validRequestId,
      );
    });

    it('should return HTTP 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/payments/by-request/${validRequestId}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return HTTP 400 for invalid ObjectId format', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/by-request/invalid-id-format')
        .set('Authorization', 'Bearer customer-token');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid request ID format');
    });

    it('should return HTTP 404 when payment does not exist', async () => {
      mockPaymentsService.getPaymentByRequestId.mockRejectedValue(
        new NotFoundException('Payment record not found for this request'),
      );

      const res = await request(app.getHttpServer())
        .get(`/api/payments/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer customer-token');

      expect(res.status).toBe(404);
    });
  });
});
