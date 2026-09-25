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
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from '../socket/chat.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import {
  ConversationEntity,
  MessageEntity,
  PaginatedResponse,
} from './interfaces/chat.interface';

describe('ChatController (API Route Contract Tests)', () => {
  let app: INestApplication;

  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validConversationId = '65f3c3c3c3c3c3c3c3c3c3c3';
  const customerId = '507f1f77bcf86cd799439011';
  const providerId = '507f1f77bcf86cd799439022';
  const thirdPartyId = '507f1f77bcf86cd799439099';

  const mockCustomer = {
    id: customerId,
    email: 'customer@test.com',
    role: 'customer',
  };

  const mockProvider = {
    id: providerId,
    email: 'provider@test.com',
    role: 'provider',
  };

  const mockThirdParty = {
    id: thirdPartyId,
    email: 'intruder@test.com',
    role: 'customer',
  };

  const mockConversationEntity: ConversationEntity = {
    id: validConversationId,
    requestId: validRequestId,
    customerId,
    providerId,
    createdAt: '2026-09-25T15:00:00.000Z',
    updatedAt: '2026-09-25T15:00:00.000Z',
  };

  const mockMessageEntity: MessageEntity = {
    id: '65f4d4d4d4d4d4d4d4d4d4d4',
    conversationId: validConversationId,
    senderId: customerId,
    content: 'Hello, what time will you arrive?',
    createdAt: '2026-09-25T15:05:00.000Z',
  };

  const mockPaginatedMessages: PaginatedResponse<MessageEntity> = {
    data: [mockMessageEntity],
    pagination: {
      page: 1,
      limit: 30,
      total: 1,
      totalPages: 1,
    },
  };

  const mockChatService = {
    getOrCreateConversation: jest.fn(),
    getConversationById: jest.fn(),
    getConversationByRequestId: jest.fn(),
    ensureConversation: jest.fn(),
    saveMessage: jest.fn(),
    getMessages: jest.fn(),
  };

  const mockChatGateway = {
    broadcastMessage: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: ChatGateway,
          useValue: mockChatGateway,
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
          if (authHeader === 'Bearer provider-token') {
            req.user = mockProvider;
            return true;
          }
          if (authHeader === 'Bearer third-party-token') {
            req.user = mockThirdParty;
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

  describe('GET /api/conversations/by-request/:requestId', () => {
    it('should allow customer participant to fetch conversation by request ID', async () => {
      mockChatService.getConversationByRequestId.mockResolvedValue(
        mockConversationEntity,
      );

      const res = await request(app.getHttpServer())
        .get(`/conversations/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer customer-token')
        .expect(200);

      expect(res.body.id).toBe(validConversationId);
      expect(res.body.requestId).toBe(validRequestId);
      expect(mockChatService.getConversationByRequestId).toHaveBeenCalledWith(
        validRequestId,
        customerId,
      );
    });

    it('should allow provider participant to fetch conversation by request ID', async () => {
      mockChatService.getConversationByRequestId.mockResolvedValue(
        mockConversationEntity,
      );

      const res = await request(app.getHttpServer())
        .get(`/conversations/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer provider-token')
        .expect(200);

      expect(res.body.id).toBe(validConversationId);
      expect(mockChatService.getConversationByRequestId).toHaveBeenCalledWith(
        validRequestId,
        providerId,
      );
    });

    it('should reject third-party user with HTTP 403 Forbidden', async () => {
      mockChatService.getConversationByRequestId.mockRejectedValue(
        new ForbiddenException(
          'You are not authorized to access this conversation',
        ),
      );

      const res = await request(app.getHttpServer())
        .get(`/conversations/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer third-party-token')
        .expect(403);

      expect(res.body.message).toContain('not authorized');
    });

    it('should reject unaccepted request with HTTP 400 Bad Request', async () => {
      mockChatService.getConversationByRequestId.mockRejectedValue(
        new BadRequestException(
          'Conversation cannot be created for a request that has not been accepted',
        ),
      );

      const res = await request(app.getHttpServer())
        .get(`/conversations/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer customer-token')
        .expect(400);

      expect(res.body.message).toContain('not been accepted');
    });

    it('should return HTTP 404 if request is not found', async () => {
      mockChatService.getConversationByRequestId.mockRejectedValue(
        new NotFoundException('Service request not found'),
      );

      const res = await request(app.getHttpServer())
        .get(`/conversations/by-request/${validRequestId}`)
        .set('Authorization', 'Bearer customer-token')
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return HTTP 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/by-request/${validRequestId}`)
        .expect(401);
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    it('should allow customer participant to fetch conversation messages with pagination', async () => {
      mockChatService.getMessages.mockResolvedValue(mockPaginatedMessages);

      const res = await request(app.getHttpServer())
        .get(`/conversations/${validConversationId}/messages?page=1&limit=30`)
        .set('Authorization', 'Bearer customer-token')
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(1);
      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        validConversationId,
        customerId,
        { page: 1, limit: 30 },
      );
    });

    it('should allow provider participant to fetch conversation messages', async () => {
      mockChatService.getMessages.mockResolvedValue(mockPaginatedMessages);

      const res = await request(app.getHttpServer())
        .get(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer provider-token')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        validConversationId,
        providerId,
        expect.any(Object),
      );
    });

    it('should reject third-party user attempting to fetch conversation messages with HTTP 403', async () => {
      mockChatService.getMessages.mockRejectedValue(
        new ForbiddenException(
          'You are not authorized to view messages for this conversation',
        ),
      );

      const res = await request(app.getHttpServer())
        .get(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer third-party-token')
        .expect(403);

      expect(res.body.message).toContain('not authorized');
    });

    it('should reject invalid pagination limit > 50 with HTTP 400', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/${validConversationId}/messages?limit=999`)
        .set('Authorization', 'Bearer customer-token')
        .expect(400);
    });

    it('should return HTTP 404 when conversation is not found', async () => {
      mockChatService.getMessages.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await request(app.getHttpServer())
        .get(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer customer-token')
        .expect(404);
    });

    it('should return HTTP 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/${validConversationId}/messages`)
        .expect(401);
    });
  });

  describe('POST /api/conversations/ensure', () => {
    it('should ensure conversation exists and return conversation entity', async () => {
      mockChatService.ensureConversation.mockResolvedValue(
        mockConversationEntity,
      );

      const res = await request(app.getHttpServer())
        .post('/conversations/ensure')
        .set('Authorization', 'Bearer customer-token')
        .send({ requestId: validRequestId })
        .expect(200);

      expect(res.body.id).toBe(validConversationId);
      expect(mockChatService.ensureConversation).toHaveBeenCalledWith(
        validRequestId,
        customerId,
        undefined,
        undefined,
      );
    });

    it('should reject request missing requestId with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/conversations/ensure')
        .set('Authorization', 'Bearer customer-token')
        .send({})
        .expect(400);
    });

    it('should return HTTP 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/conversations/ensure')
        .send({ requestId: validRequestId })
        .expect(401);
    });
  });

  describe('POST /api/conversations/:id/messages', () => {
    it('should save and return message entity for customer participant', async () => {
      mockChatService.saveMessage.mockResolvedValue(mockMessageEntity);

      const res = await request(app.getHttpServer())
        .post(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer customer-token')
        .send({ content: 'Hello, what time will you arrive?' })
        .expect(201);

      expect(res.body.id).toBe('65f4d4d4d4d4d4d4d4d4d4d4');
      expect(res.body.content).toBe('Hello, what time will you arrive?');
      expect(mockChatService.saveMessage).toHaveBeenCalledWith(
        validConversationId,
        customerId,
        'Hello, what time will you arrive?',
      );
      expect(mockChatGateway.broadcastMessage).toHaveBeenCalledWith(
        validConversationId,
        mockMessageEntity,
      );
    });

    it('should save and return message entity for provider participant', async () => {
      mockChatService.saveMessage.mockResolvedValue({
        ...mockMessageEntity,
        senderId: providerId,
        content: 'On my way!',
      });

      const res = await request(app.getHttpServer())
        .post(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer provider-token')
        .send({ content: 'On my way!' })
        .expect(201);

      expect(res.body.senderId).toBe(providerId);
      expect(res.body.content).toBe('On my way!');
    });

    it('should reject empty message content with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer customer-token')
        .send({ content: '' })
        .expect(400);
    });

    it('should reject whitespace-only message content with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer customer-token')
        .send({ content: '     ' })
        .expect(400);
    });

    it('should reject third-party sender with HTTP 403 Forbidden', async () => {
      mockChatService.saveMessage.mockRejectedValue(
        new ForbiddenException(
          'Sender is not a participant in this conversation',
        ),
      );

      const res = await request(app.getHttpServer())
        .post(`/conversations/${validConversationId}/messages`)
        .set('Authorization', 'Bearer third-party-token')
        .send({ content: 'Intruder message' })
        .expect(403);

      expect(res.body.message).toContain('not a participant');
    });

    it('should return HTTP 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post(`/conversations/${validConversationId}/messages`)
        .send({ content: 'Hello' })
        .expect(401);
    });
  });
});
