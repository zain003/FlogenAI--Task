import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

describe('AuthController (API Layer Contract Tests)', () => {
  let app: INestApplication;

  const mockAuthResponse = {
    accessToken: 'valid.mocked.jwt.token',
    user: {
      id: '507f1f77bcf86cd799439011',
      email: 'customer@test.com',
      name: 'Test Customer',
      role: 'customer' as const,
    },
  };

  const mockUserProfile = {
    id: '507f1f77bcf86cd799439011',
    email: 'customer@test.com',
    name: 'Test Customer',
    role: 'customer' as const,
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60000,
            limit: 10,
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
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
            req.user = { id: '507f1f77bcf86cd799439011', email: 'customer@test.com', role: 'customer' };
            return true;
          }
          if (authHeader === 'Bearer provider-token') {
            req.user = { id: '507f1f77bcf86cd799439022', email: 'provider@test.com', role: 'provider' };
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

  describe('POST /api/auth/register', () => {
    it('should register a new customer and return JWT with HTTP 201', async () => {
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'customer@test.com',
          password: 'Password123!',
          name: 'Test Customer',
          role: 'customer',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken', 'valid.mocked.jwt.token');
      expect(response.body.user).toEqual({
        id: '507f1f77bcf86cd799439011',
        email: 'customer@test.com',
        name: 'Test Customer',
        role: 'customer',
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(mockAuthService.register).toHaveBeenCalledWith({
        email: 'customer@test.com',
        password: 'Password123!',
        name: 'Test Customer',
        role: 'customer',
      });
    });

    it('should reject registration with duplicate email with HTTP 409 Conflict', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('A user with this email address already exists'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'customer@test.com',
          password: 'Password123!',
          name: 'Test Customer',
          role: 'customer',
        })
        .expect(409);

      expect(response.body).toHaveProperty('statusCode', 409);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with invalid email or weak password with HTTP 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'short',
          name: 'A',
          role: 'invalid-role',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should reject registration with empty body with HTTP 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate valid credentials and return signed JWT with HTTP 200', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'customer@test.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken', 'valid.mocked.jwt.token');
      expect(response.body.user.email).toBe('customer@test.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with wrong password with HTTP 401 Unauthorized', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid email or password'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'customer@test.com',
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with malformed email with HTTP 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should reject requests with HTTP 429 when exceeding 10 login attempts in 60 seconds', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      // Send 7 more requests to reach the 10 limit (3 already sent in preceding tests)
      for (let i = 0; i < 7; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'customer@test.com',
            password: 'Password123!',
          });
      }

      // 11th request exceeds limit and must return HTTP 429 Too Many Requests
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'customer@test.com',
          password: 'Password123!',
        })
        .expect(429);

      expect(response.body.statusCode).toBe(429);
      expect(response.body.message).toContain('ThrottlerException');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject access with HTTP 401 without Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should allow access to protected route when valid JWT is supplied', async () => {
      mockAuthService.getProfile.mockResolvedValue(mockUserProfile);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer customer-token')
        .expect(200);

      expect(response.body).toEqual(mockUserProfile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  describe('RBAC Route Protection', () => {
    it('should allow access to customer-protected route when role is customer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/customer-only')
        .set('Authorization', 'Bearer customer-token')
        .expect(200);

      expect(response.body.message).toContain('Access granted');
    });

    it('should reject access with HTTP 403 when user role does not match required @Roles()', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/customer-only')
        .set('Authorization', 'Bearer provider-token')
        .expect(403);

      expect(response.body.statusCode).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
  });
});
