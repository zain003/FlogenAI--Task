import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import * as request from 'supertest';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { ServiceRequestEntity, PaginatedResponse } from './interfaces/request.interface';

describe('RequestsController (API Layer Contract Tests)', () => {
  let app: INestApplication;

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

  const mockRequestEntity: ServiceRequestEntity = {
    id: '65f1a1a1a1a1a1a1a1a1a1a1',
    title: 'Need HVAC Repair',
    description: 'Central air conditioning unit is blowing warm air.',
    budget: 350,
    status: 'OPEN',
    customerId: '507f1f77bcf86cd799439011',
    acceptedOfferId: null,
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  };

  const mockPaginatedRequests: PaginatedResponse<ServiceRequestEntity> = {
    data: [mockRequestEntity],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  };

  const mockRequestsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByCustomer: jest.fn(),
    findById: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: RequestsService,
          useValue: mockRequestsService,
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
            throw new UnauthorizedException('Authentication token is missing or invalid');
          }
          if (authHeader === 'Bearer customer-token') {
            req.user = mockCustomer;
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

  describe('POST /api/requests', () => {
    it('should allow authenticated customer to create request with HTTP 201', async () => {
      mockRequestsService.create.mockResolvedValue(mockRequestEntity);

      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer customer-token')
        .send({
          title: 'Need HVAC Repair',
          description: 'Central air conditioning unit is blowing warm air.',
          budget: 350,
        })
        .expect(201);

      expect(mockRequestsService.create).toHaveBeenCalledWith(
        mockCustomer.id,
        {
          title: 'Need HVAC Repair',
          description: 'Central air conditioning unit is blowing warm air.',
          budget: 350,
        },
      );
      expect(response.body).toEqual(mockRequestEntity);
      expect(response.body.status).toBe('OPEN');
      expect(response.body.customerId).toBe(mockCustomer.id);
    });

    it('should reject request creation by provider with HTTP 403 Forbidden', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer provider-token')
        .send({
          title: 'Need HVAC Repair',
          description: 'Central air conditioning unit is blowing warm air.',
          budget: 350,
        })
        .expect(403);

      expect(response.body.statusCode).toBe(403);
      expect(mockRequestsService.create).not.toHaveBeenCalled();
    });

    it('should reject request creation without authentication with HTTP 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .send({
          title: 'Need HVAC Repair',
          description: 'Central air conditioning unit is blowing warm air.',
          budget: 350,
        })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(mockRequestsService.create).not.toHaveBeenCalled();
    });

    it('should reject request creation with negative budget or empty title with HTTP 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer customer-token')
        .send({
          title: '',
          description: 'Valid description with sufficient length.',
          budget: -10,
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(mockRequestsService.create).not.toHaveBeenCalled();
    });

    it('should reject request creation with short description with HTTP 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer customer-token')
        .send({
          title: 'Valid Title',
          description: 'Too short',
          budget: 100,
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(mockRequestsService.create).not.toHaveBeenCalled();
    });

    it('should reject request creation with whitespace-only title or description with HTTP 400 (ISSUE-001)', async () => {
      const whitespaceTitleResponse = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer customer-token')
        .send({
          title: '   ',
          description: 'Valid description with sufficient length.',
          budget: 100,
        })
        .expect(400);

      expect(whitespaceTitleResponse.body.statusCode).toBe(400);
      expect(whitespaceTitleResponse.body.errors).toBeDefined();

      const whitespaceDescResponse = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer customer-token')
        .send({
          title: 'Valid Service Title',
          description: '          ',
          budget: 100,
        })
        .expect(400);

      expect(whitespaceDescResponse.body.statusCode).toBe(400);
      expect(whitespaceDescResponse.body.errors).toBeDefined();
      expect(mockRequestsService.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/requests', () => {
    it('should list open requests with pagination metadata', async () => {
      mockRequestsService.findAll.mockResolvedValue(mockPaginatedRequests);

      const response = await request(app.getHttpServer())
        .get('/api/requests?page=1&limit=20&status=OPEN')
        .expect(200);

      expect(mockRequestsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
          status: 'OPEN',
        }),
      );
      expect(response.body).toEqual(mockPaginatedRequests);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should enforce maximum limit of 50 on request list queries', async () => {
      mockRequestsService.findAll.mockImplementation((query) => {
        return Promise.resolve({
          data: [],
          pagination: {
            page: query.page || 1,
            limit: Math.min(query.limit || 20, 50),
            total: 0,
            totalPages: 0,
          },
        });
      });

      const response = await request(app.getHttpServer())
        .get('/api/requests?limit=100')
        .expect(200);

      expect(mockRequestsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        }),
      );
      expect(response.body.pagination.limit).toBe(50);
    });
  });

  describe('GET /api/requests/my-requests', () => {
    it('should allow customer to fetch personal requests with HTTP 200', async () => {
      mockRequestsService.findByCustomer.mockResolvedValue(mockPaginatedRequests);

      const response = await request(app.getHttpServer())
        .get('/api/requests/my-requests?page=1&limit=10')
        .set('Authorization', 'Bearer customer-token')
        .expect(200);

      expect(mockRequestsService.findByCustomer).toHaveBeenCalledWith(
        mockCustomer.id,
        expect.objectContaining({
          page: 1,
          limit: 10,
        }),
      );
      expect(response.body).toEqual(mockPaginatedRequests);
    });

    it('should reject GET /api/requests/my-requests by provider with HTTP 403', async () => {
      await request(app.getHttpServer())
        .get('/api/requests/my-requests')
        .set('Authorization', 'Bearer provider-token')
        .expect(403);

      expect(mockRequestsService.findByCustomer).not.toHaveBeenCalled();
    });

    it('should reject GET /api/requests/my-requests without token with HTTP 401', async () => {
      await request(app.getHttpServer())
        .get('/api/requests/my-requests')
        .expect(401);

      expect(mockRequestsService.findByCustomer).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/requests/:id', () => {
    it('should return 404 Not Found when querying non-existent request ID', async () => {
      mockRequestsService.findById.mockResolvedValue(null);

      const nonExistentId = '507f1f77bcf86cd799439099';
      const response = await request(app.getHttpServer())
        .get(`/api/requests/${nonExistentId}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('not found');
      expect(mockRequestsService.findById).toHaveBeenCalledWith(nonExistentId);
    });

    it('should return HTTP 400 Bad Request when querying with invalid ObjectId format', async () => {
      const invalidId = 'invalid-mongo-id';
      const response = await request(app.getHttpServer())
        .get(`/api/requests/${invalidId}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('Invalid request ID format');
      expect(mockRequestsService.findById).not.toHaveBeenCalled();
    });

    it('should return 200 OK with request entity for valid existing ID', async () => {
      mockRequestsService.findById.mockResolvedValue(mockRequestEntity);

      const response = await request(app.getHttpServer())
        .get(`/api/requests/${mockRequestEntity.id}`)
        .expect(200);

      expect(response.body).toEqual(mockRequestEntity);
      expect(mockRequestsService.findById).toHaveBeenCalledWith(mockRequestEntity.id);
    });
  });
});
