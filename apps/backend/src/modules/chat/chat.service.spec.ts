import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { Conversation } from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';
import { ServiceRequest } from '../requests/schemas/service-request.schema';
import { Offer } from '../offers/schemas/offer.schema';

describe('ChatService (Domain Logic & Persistence Tests)', () => {
  let service: ChatService;

  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validOfferId = '65f2b2b2b2b2b2b2b2b2b2b2';
  const validConversationId = '65f3c3c3c3c3c3c3c3c3c3c3';
  const customerId = '507f1f77bcf86cd799439011';
  const providerId = '507f1f77bcf86cd799439022';
  const thirdPartyId = '507f1f77bcf86cd799439099';

  const mockConversationDoc = {
    _id: validConversationId,
    id: validConversationId,
    requestId: validRequestId,
    customerId,
    providerId,
    createdAt: new Date('2026-09-25T15:00:00.000Z'),
    updatedAt: new Date('2026-09-25T15:00:00.000Z'),
  };

  const mockRequestDoc = {
    _id: validRequestId,
    id: validRequestId,
    title: 'Fix Leaking Pipe',
    description: 'Emergency leak in kitchen under the sink',
    budget: 250,
    status: 'ACCEPTED',
    customerId,
    acceptedOfferId: validOfferId,
    createdAt: new Date('2026-09-25T14:00:00.000Z'),
    updatedAt: new Date('2026-09-25T14:30:00.000Z'),
  };

  const mockOfferDoc = {
    _id: validOfferId,
    id: validOfferId,
    requestId: validRequestId,
    providerId,
    price: 250,
    message: 'I can fix this immediately today',
    status: 'ACCEPTED',
    createdAt: new Date('2026-09-25T14:10:00.000Z'),
    updatedAt: new Date('2026-09-25T14:30:00.000Z'),
  };

  const mockMessageDoc = {
    _id: '65f4d4d4d4d4d4d4d4d4d4d4',
    id: '65f4d4d4d4d4d4d4d4d4d4d4',
    conversationId: validConversationId,
    senderId: customerId,
    content: 'Hello, what time will you arrive?',
    createdAt: new Date('2026-09-25T15:05:00.000Z'),
    updatedAt: new Date('2026-09-25T15:05:00.000Z'),
  };

  let mockConversationModel: any;
  let mockMessageModel: any;
  let mockRequestModel: any;
  let mockOfferModel: any;

  beforeEach(async () => {
    mockConversationModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockMessageModel = {
      create: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    };

    mockRequestModel = {
      findById: jest.fn(),
    };

    mockOfferModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        {
          provide: getModelToken(Message.name),
          useValue: mockMessageModel,
        },
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
        {
          provide: getModelToken(Offer.name),
          useValue: mockOfferModel,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('getOrCreateConversation', () => {
    it('should create or return existing conversation for accepted request', async () => {
      // 1. None exists initially -> creates new
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockConversationModel.create.mockResolvedValue(mockConversationDoc);

      const created = await service.getOrCreateConversation(
        validRequestId,
        customerId,
        providerId,
      );

      expect(mockConversationModel.findOne).toHaveBeenCalledWith({
        requestId: validRequestId,
      });
      expect(mockConversationModel.create).toHaveBeenCalledWith({
        requestId: validRequestId,
        customerId,
        providerId,
      });
      expect(created.id).toBe(validConversationId);
      expect(created.requestId).toBe(validRequestId);
      expect(created.customerId).toBe(customerId);
      expect(created.providerId).toBe(providerId);

      // 2. Already exists -> returns existing without creating
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });

      const existing = await service.getOrCreateConversation(
        validRequestId,
        customerId,
        providerId,
      );
      expect(existing.id).toBe(validConversationId);
      expect(mockConversationModel.create).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent E11000 duplicate key race gracefully', async () => {
      mockConversationModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(mockConversationDoc),
        });

      mockConversationModel.create.mockRejectedValue({
        code: 11000,
        message: 'E11000 duplicate key error collection',
      });

      const result = await service.getOrCreateConversation(
        validRequestId,
        customerId,
        providerId,
      );

      expect(result.id).toBe(validConversationId);
      expect(mockConversationModel.create).toHaveBeenCalled();
    });

    it('should reject if required arguments are missing', async () => {
      await expect(
        service.getOrCreateConversation('', customerId, providerId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConversationByRequestId', () => {
    it('should return existing conversation for customer participant', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });

      const result = await service.getConversationByRequestId(
        validRequestId,
        customerId,
      );
      expect(result.id).toBe(validConversationId);
    });

    it('should return existing conversation for provider participant', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });

      const result = await service.getConversationByRequestId(
        validRequestId,
        providerId,
      );
      expect(result.id).toBe(validConversationId);
    });

    it('should reject non-participant user attempting to fetch conversation with HTTP 403', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });

      await expect(
        service.getConversationByRequestId(validRequestId, thirdPartyId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should resolve and create conversation if not exists yet but request is accepted', async () => {
      mockConversationModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRequestDoc),
      });
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOfferDoc),
      });
      mockConversationModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockConversationModel.create.mockResolvedValue(mockConversationDoc);

      const result = await service.getConversationByRequestId(
        validRequestId,
        customerId,
      );
      expect(result.id).toBe(validConversationId);
    });

    it('should reject with 404 if service request does not exist', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getConversationByRequestId(validRequestId, customerId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject with 400 if request is still OPEN (not yet accepted)', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockRequestDoc,
          status: 'OPEN',
          acceptedOfferId: null,
        }),
      });

      await expect(
        service.getConversationByRequestId(validRequestId, customerId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('saveMessage', () => {
    it('should persist message entity in database with sender ID and timestamp', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.create.mockResolvedValue(mockMessageDoc);

      const result = await service.saveMessage(
        validConversationId,
        customerId,
        'Hello, what time will you arrive?',
      );

      expect(mockMessageModel.create).toHaveBeenCalledWith({
        conversationId: validConversationId,
        senderId: customerId,
        content: 'Hello, what time will you arrive?',
      });
      expect(result.id).toBe('65f4d4d4d4d4d4d4d4d4d4d4');
      expect(result.conversationId).toBe(validConversationId);
      expect(result.senderId).toBe(customerId);
      expect(result.content).toBe('Hello, what time will you arrive?');
      expect(result.createdAt).toBeDefined();
    });

    it('should allow provider participant to save message', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.create.mockResolvedValue({
        ...mockMessageDoc,
        senderId: providerId,
        content: 'I will be there in 30 minutes.',
      });

      const result = await service.saveMessage(
        validConversationId,
        providerId,
        'I will be there in 30 minutes.',
      );

      expect(result.senderId).toBe(providerId);
      expect(result.content).toBe('I will be there in 30 minutes.');
    });

    it('should trim whitespace from message content before persisting', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.create.mockResolvedValue({
        ...mockMessageDoc,
        content: 'Trimmed message',
      });

      await service.saveMessage(
        validConversationId,
        customerId,
        '   Trimmed message   ',
      );

      expect(mockMessageModel.create).toHaveBeenCalledWith({
        conversationId: validConversationId,
        senderId: customerId,
        content: 'Trimmed message',
      });
    });

    it('should reject empty or whitespace-only messages with BadRequestException (400)', async () => {
      await expect(
        service.saveMessage(validConversationId, customerId, '   '),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.saveMessage(validConversationId, customerId, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject messages exceeding 2000 characters with BadRequestException (400)', async () => {
      const longMessage = 'a'.repeat(2001);
      await expect(
        service.saveMessage(validConversationId, customerId, longMessage),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if conversation does not exist with NotFoundException (404)', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.saveMessage(validConversationId, customerId, 'Valid message'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject third-party user attempting to send message with HTTP 403', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });

      await expect(
        service.saveMessage(validConversationId, thirdPartyId, 'Intruder message'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    const mockMessagesList = [
      {
        _id: '65f4d4d4d4d4d4d4d4d4d4d2',
        conversationId: validConversationId,
        senderId: providerId,
        content: 'I will be there in 30 minutes.',
        createdAt: new Date('2026-09-25T15:06:00.000Z'),
      },
      {
        _id: '65f4d4d4d4d4d4d4d4d4d4d1',
        conversationId: validConversationId,
        senderId: customerId,
        content: 'Hello, what time will you arrive?',
        createdAt: new Date('2026-09-25T15:05:00.000Z'),
      },
    ];

    it('should allow customer participant to fetch conversation messages', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessagesList),
      });

      const result = await service.getMessages(validConversationId, customerId);

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.limit).toBe(30);
    });

    it('should allow provider participant to fetch conversation messages', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessagesList),
      });

      const result = await service.getMessages(validConversationId, providerId);

      expect(result.data.length).toBe(2);
    });

    it('should reject third-party user attempting to fetch conversation messages with HTTP 403', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });

      await expect(
        service.getMessages(validConversationId, thirdPartyId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should paginate messages in reverse chronological order', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(45),
      });

      const sortMock = jest.fn().mockReturnThis();
      const skipMock = jest.fn().mockReturnThis();
      const limitMock = jest.fn().mockReturnThis();
      const leanMock = jest.fn().mockReturnThis();
      const execMock = jest.fn().mockResolvedValue(mockMessagesList);

      mockMessageModel.find.mockReturnValue({
        sort: sortMock,
        skip: skipMock,
        limit: limitMock,
        lean: leanMock,
        exec: execMock,
      });

      const result = await service.getMessages(validConversationId, customerId, {
        page: 2,
        limit: 20,
      });

      expect(mockMessageModel.find).toHaveBeenCalledWith({
        conversationId: validConversationId,
      });
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(skipMock).toHaveBeenCalledWith(20);
      expect(limitMock).toHaveBeenCalledWith(20);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(45);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should cap limit at 50 if higher limit requested', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversationDoc),
      });
      mockMessageModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(100),
      });
      const limitMock = jest.fn().mockReturnThis();
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: limitMock,
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getMessages(validConversationId, customerId, {
        page: 1,
        limit: 99,
      });

      expect(limitMock).toHaveBeenCalledWith(50);
      expect(result.pagination.limit).toBe(50);
    });

    it('should reject if conversation does not exist with NotFoundException (404)', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getMessages(validConversationId, customerId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
