import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import {
  AcceptOfferResponse,
  OfferEntity,
  PaginatedResponse,
} from './interfaces/offer.interface';

describe('OffersController (API Layer Contract Tests)', () => {
  let app: INestApplication;

  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validOfferId = '65f2b2b2b2b2b2b2b2b2b2b2';

  const mockCustomer = {
    id: '507f1f77bcf86cd799439011',
    email: 'customer@test.com',
    role: 'customer',
  };

  const mockOtherCustomer = {
    id: '507f1f77bcf86cd799439099',
    email: 'othercustomer@test.com',
    role: 'customer',
  };

  const mockProvider = {
    id: '507f1f77bcf86cd799439022',
    email: 'provider@test.com',
    role: 'provider',
  };

  const mockOfferEntity: OfferEntity = {
    id: validOfferId,
    requestId: validRequestId,
    providerId: mockProvider.id,
    price: 300,
    message: 'Expert plumbing diagnostic and pipe repair within 2 hours.',
    status: 'PENDING',
    createdAt: '2026-09-25T14:00:00.000Z',
    updatedAt: '2026-09-25T14:00:00.000Z',
  };

  const mockAcceptedOfferResponse: AcceptOfferResponse = {
    success: true,
    offer: {
      ...mockOfferEntity,
      status: 'ACCEPTED',
    },
    paymentPending: true,
  };

  const mockPaginatedOffers: PaginatedResponse<OfferEntity> = {
    data: [mockOfferEntity],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  };

  const mockOffersService = {
    createOffer: jest.fn(),
    findOffersByRequest: jest.fn(),
    findOfferById: jest.fn(),
    acceptOffer: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        {
          provide: OffersService,
          useValue: mockOffersService,
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
            throw new UnauthorizedException(
              'Authentication token is missing or invalid',
            );
          }
          if (authHeader === 'Bearer customer-token') {
            req.user = mockCustomer;
            return true;
          }
          if (authHeader === 'Bearer other-customer-token') {
            req.user = mockOtherCustomer;
            return true;
          }
          if (authHeader === 'Bearer provider-token') {
            req.user = mockProvider;
            return true;
          }
          throw new UnauthorizedException('Invalid or expired token');
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

  describe('POST /api/requests/:id/offers', () => {
    it('should allow authenticated provider to submit offer on open request with HTTP 201', async () => {
      mockOffersService.createOffer.mockResolvedValue(mockOfferEntity);

      const payload = {
        price: 300,
        message: 'Expert plumbing diagnostic and pipe repair within 2 hours.',
      };

      const res = await request(app.getHttpServer())
        .post(`/api/requests/${validRequestId}/offers`)
        .set('Authorization', 'Bearer provider-token')
        .send(payload)
        .expect(201);

      expect(res.body).toEqual(mockOfferEntity);
      expect(mockOffersService.createOffer).toHaveBeenCalledWith(
        validRequestId,
        mockProvider.id,
        payload,
      );
    });

    it('should reject offer submission without authentication with HTTP 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/requests/${validRequestId}/offers`)
        .send({
          price: 300,
          message: 'Valid message without auth',
        })
        .expect(401);

      expect(mockOffersService.createOffer).not.toHaveBeenCalled();
    });

    it('should reject offer submission by customer with HTTP 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post(`/api/requests/${validRequestId}/offers`)
        .set('Authorization', 'Bearer customer-token')
        .send({
          price: 300,
          message: 'Customer attempting to bid',
        })
        .expect(403);

      expect(mockOffersService.createOffer).not.toHaveBeenCalled();
    });

    it('should reject offer submission with invalid price (<= 0) or short message with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/requests/${validRequestId}/offers`)
        .set('Authorization', 'Bearer provider-token')
        .send({
          price: -50,
          message: 'Hi',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(mockOffersService.createOffer).not.toHaveBeenCalled();
    });

    it('should reject offer submission with invalid ObjectId format with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/api/requests/not-a-valid-id/offers')
        .set('Authorization', 'Bearer provider-token')
        .send({
          price: 200,
          message: 'Valid proposal message',
        })
        .expect(400);

      expect(mockOffersService.createOffer).not.toHaveBeenCalled();
    });

    it('should reject offer submission on closed or accepted request with HTTP 400', async () => {
      mockOffersService.createOffer.mockRejectedValue(
        new BadRequestException('Cannot submit offer on request with status ACCEPTED'),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/requests/${validRequestId}/offers`)
        .set('Authorization', 'Bearer provider-token')
        .send({
          price: 250,
          message: 'Submitting offer to accepted request',
        })
        .expect(400);

      expect(res.body.message).toContain('Cannot submit offer on request with status ACCEPTED');
    });
  });

  describe('GET /api/requests/:id/offers', () => {
    it('should list offers on request with pagination metadata', async () => {
      mockOffersService.findOffersByRequest.mockResolvedValue(mockPaginatedOffers);

      const res = await request(app.getHttpServer())
        .get(`/api/requests/${validRequestId}/offers?page=1&limit=20`)
        .expect(200);

      expect(res.body).toEqual(mockPaginatedOffers);
      expect(mockOffersService.findOffersByRequest).toHaveBeenCalledWith(
        validRequestId,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('should return HTTP 400 when querying with invalid ObjectId format', async () => {
      await request(app.getHttpServer())
        .get('/api/requests/invalid-request-id/offers')
        .expect(400);

      expect(mockOffersService.findOffersByRequest).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/offers/:id/accept', () => {
    it('should allow customer who owns request to accept an offer with HTTP 200', async () => {
      mockOffersService.acceptOffer.mockResolvedValue(mockAcceptedOfferResponse);

      const res = await request(app.getHttpServer())
        .post(`/api/offers/${validOfferId}/accept`)
        .set('Authorization', 'Bearer customer-token')
        .expect(200);

      expect(res.body).toEqual(mockAcceptedOfferResponse);
      expect(res.body.success).toBe(true);
      expect(res.body.offer.status).toBe('ACCEPTED');
      expect(res.body.paymentPending).toBe(true);
      expect(mockOffersService.acceptOffer).toHaveBeenCalledWith(
        validOfferId,
        mockCustomer.id,
      );
    });

    it('should reject offer acceptance without authentication with HTTP 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/offers/${validOfferId}/accept`)
        .expect(401);

      expect(mockOffersService.acceptOffer).not.toHaveBeenCalled();
    });

    it('should reject offer acceptance by provider with HTTP 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post(`/api/offers/${validOfferId}/accept`)
        .set('Authorization', 'Bearer provider-token')
        .expect(403);

      expect(mockOffersService.acceptOffer).not.toHaveBeenCalled();
    });

    it('should reject offer acceptance by a user who does not own the request with HTTP 403', async () => {
      mockOffersService.acceptOffer.mockRejectedValue(
        new ForbiddenException('You do not have permission to accept offers for this service request'),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/offers/${validOfferId}/accept`)
        .set('Authorization', 'Bearer other-customer-token')
        .expect(403);

      expect(res.body.message).toContain('You do not have permission');
    });

    it('should reject offer acceptance with HTTP 409 when request is already accepted', async () => {
      mockOffersService.acceptOffer.mockRejectedValue(
        new ConflictException('Service request is no longer OPEN for acceptance (status: ACCEPTED)'),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/offers/${validOfferId}/accept`)
        .set('Authorization', 'Bearer customer-token')
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.message).toContain('no longer OPEN');
    });

    it('should reject offer acceptance with HTTP 409 when lock is held by another process', async () => {
      mockOffersService.acceptOffer.mockRejectedValue(
        new ConflictException('Concurrent acceptance in progress for this request. Please retry.'),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/offers/${validOfferId}/accept`)
        .set('Authorization', 'Bearer customer-token')
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.message).toContain('Concurrent acceptance in progress');
    });

    it('should return HTTP 400 for invalid offer ID format', async () => {
      await request(app.getHttpServer())
        .post('/api/offers/invalid-offer-id/accept')
        .set('Authorization', 'Bearer customer-token')
        .expect(400);

      expect(mockOffersService.acceptOffer).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/offers/:id', () => {
    it('should return offer by id with HTTP 200', async () => {
      mockOffersService.findOfferById.mockResolvedValue(mockOfferEntity);

      const res = await request(app.getHttpServer())
        .get(`/api/offers/${validOfferId}`)
        .expect(200);

      expect(res.body).toEqual(mockOfferEntity);
    });

    it('should return HTTP 404 if offer does not exist', async () => {
      mockOffersService.findOfferById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/offers/${validOfferId}`)
        .expect(404);
    });
  });
});
