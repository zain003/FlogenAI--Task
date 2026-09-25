import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from '../chat/chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConversationEntity,
  MessageEntity,
} from '../chat/interfaces/chat.interface';

describe('ChatGateway & Room Authorization (Real-Time Integration Tests)', () => {
  let gateway: ChatGateway;
  let chatService: jest.Mocked<ChatService>;
  let jwtService: jest.Mocked<JwtService>;

  const validConversationId = '65f3c3c3c3c3c3c3c3c3c3c3';
  const customerId = '507f1f77bcf86cd799439011';
  const providerId = '507f1f77bcf86cd799439022';
  const thirdPartyId = '507f1f77bcf86cd799439099';

  const mockConversation: ConversationEntity = {
    id: validConversationId,
    requestId: '65f1a1a1a1a1a1a1a1a1a1a1',
    customerId,
    providerId,
    createdAt: '2026-09-25T15:00:00.000Z',
    updatedAt: '2026-09-25T15:00:00.000Z',
  };

  const mockSavedMessage: MessageEntity = {
    id: '65f4d4d4d4d4d4d4d4d4d4d4',
    conversationId: validConversationId,
    senderId: customerId,
    content: 'Hello, what time will you arrive?',
    createdAt: '2026-09-25T15:05:00.000Z',
  };

  let mockClient: any;
  let mockServer: any;
  let mockRoomEmitter: any;

  beforeEach(async () => {
    mockRoomEmitter = {
      emit: jest.fn(),
    };

    mockServer = {
      to: jest.fn().mockReturnValue(mockRoomEmitter),
      emit: jest.fn(),
    };

    mockClient = {
      id: 'socket-test-client-1',
      data: {
        user: {
          id: customerId,
          email: 'customer@test.com',
          role: 'customer',
        },
      },
      rooms: new Set<string>(),
      join: jest.fn(function (room: string) {
        mockClient.rooms.add(room);
      }),
      leave: jest.fn(function (room: string) {
        mockClient.rooms.delete(room);
      }),
      emit: jest.fn(),
      disconnect: jest.fn(),
      handshake: {
        auth: { token: 'valid-jwt-token' },
        headers: {},
      },
    };

    const mockChatService = {
      getConversationById: jest.fn(),
      saveMessage: jest.fn(),
      getOrCreateConversation: jest.fn(),
      getConversationByRequestId: jest.fn(),
      ensureConversation: jest.fn(),
      getMessages: jest.fn(),
    };

    const mockJwtService = {
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = mockServer;
    chatService = module.get(ChatService) as jest.Mocked<ChatService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  describe('conversation:join (Strict Server-Side Room Authorization)', () => {
    // TEST 1 from Spec: SERVER AUTH TEST: should reject conversation:join when user is neither customer nor provider of conversation
    it('SERVER AUTH TEST: should reject conversation:join when user is neither customer nor provider of conversation', async () => {
      mockClient.data.user = {
        id: thirdPartyId,
        email: 'intruder@test.com',
        role: 'customer',
      };

      chatService.getConversationById.mockResolvedValue(mockConversation);

      const res = await gateway.handleJoinConversation(mockClient, {
        conversationId: validConversationId,
      });

      expect(res.status).toBe('error');
      expect(res.error).toBe('Unauthorized room access');
      // Socket MUST NOT have joined the room
      expect(mockClient.join).not.toHaveBeenCalled();
      expect(mockClient.rooms.has(`conversation:${validConversationId}`)).toBe(false);
    });

    // TEST 2 from Spec: should allow authorized customer and provider to join conversation room
    it('should allow authorized customer and provider to join conversation room', async () => {
      chatService.getConversationById.mockResolvedValue(mockConversation);

      // Customer joins
      mockClient.data.user = {
        id: customerId,
        email: 'customer@test.com',
        role: 'customer',
      };
      const customerRes = await gateway.handleJoinConversation(mockClient, {
        conversationId: validConversationId,
      });
      expect(customerRes.status).toBe('ok');
      expect(mockClient.join).toHaveBeenCalledWith(`conversation:${validConversationId}`);
      expect(mockClient.rooms.has(`conversation:${validConversationId}`)).toBe(true);

      // Provider joins
      const providerClient: any = {
        ...mockClient,
        id: 'socket-provider-client-2',
        data: {
          user: {
            id: providerId,
            email: 'provider@test.com',
            role: 'provider',
          },
        },
        rooms: new Set<string>(),
        join: jest.fn(function (room: string) {
          providerClient.rooms.add(room);
        }),
      };

      const providerRes = await gateway.handleJoinConversation(providerClient, {
        conversationId: validConversationId,
      });
      expect(providerRes.status).toBe('ok');
      expect(providerClient.join).toHaveBeenCalledWith(`conversation:${validConversationId}`);
      expect(providerClient.rooms.has(`conversation:${validConversationId}`)).toBe(true);
    });

    it('should reject conversation:join when conversation does not exist', async () => {
      chatService.getConversationById.mockResolvedValue(null);

      const res = await gateway.handleJoinConversation(mockClient, {
        conversationId: 'non-existent-conversation',
      });

      expect(res.status).toBe('error');
      expect(res.error).toBe('Conversation not found');
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('should reject conversation:join if client is unauthenticated', async () => {
      mockClient.data.user = null;

      const res = await gateway.handleJoinConversation(mockClient, {
        conversationId: validConversationId,
      });

      expect(res.status).toBe('error');
      expect(res.error).toContain('Unauthorized');
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('message:send (Persistence & Cluster Broadcast)', () => {
    // TEST 3 from Spec: should reject message:send from socket not authorized in conversation
    it('should reject message:send from socket not authorized in conversation', async () => {
      mockClient.data.user = {
        id: thirdPartyId,
        email: 'intruder@test.com',
        role: 'customer',
      };

      chatService.getConversationById.mockResolvedValue(mockConversation);

      const res = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: 'Malicious unauthorized message',
      });

      expect(res.status).toBe('error');
      expect(res.error).toContain('Not a participant');
      expect(chatService.saveMessage).not.toHaveBeenCalled();
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    // TEST 4: should reject message:send when caller is not joined in conversation room
    it('should reject message:send from socket that is not currently joined to conversation room', async () => {
      // User is participant, but has NOT joined room via conversation:join
      mockClient.rooms = new Set<string>(); // Empty rooms
      chatService.getConversationById.mockResolvedValue(mockConversation);

      const res = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: 'Hello before join',
      });

      expect(res.status).toBe('error');
      expect(res.error).toContain('Socket is not joined');
      expect(chatService.saveMessage).not.toHaveBeenCalled();
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    // TEST 5 from Spec: should persist message to MongoDB before broadcasting message:new
    it('should persist message to MongoDB before broadcasting message:new', async () => {
      // Simulate client is joined to room
      mockClient.rooms.add(`conversation:${validConversationId}`);
      chatService.getConversationById.mockResolvedValue(mockConversation);
      chatService.saveMessage.mockResolvedValue(mockSavedMessage);

      const res = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: 'Hello, what time will you arrive?',
      });

      expect(res.status).toBe('ok');
      expect(res.message).toEqual(mockSavedMessage);

      // Verify DB persistence was called with trimmed content and sender ID
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        validConversationId,
        customerId,
        'Hello, what time will you arrive?',
      );

      // Verify broadcast to conversation room
      expect(mockServer.to).toHaveBeenCalledWith(`conversation:${validConversationId}`);
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('message:new', {
        message: mockSavedMessage,
      });
    });

    // TEST 6: should reject empty or whitespace-only messages
    it('should reject empty or whitespace-only message:send with error', async () => {
      mockClient.rooms.add(`conversation:${validConversationId}`);

      const resEmpty = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: '',
      });
      expect(resEmpty.status).toBe('error');
      expect(resEmpty.error).toBe('Message content cannot be empty');

      const resWhitespace = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: '    ',
      });
      expect(resWhitespace.status).toBe('error');
      expect(resWhitespace.error).toBe('Message content cannot be empty');
      expect(chatService.saveMessage).not.toHaveBeenCalled();
    });

    // TEST 7: should reject message exceeding 2000 characters
    it('should reject message:send exceeding 2000 characters with error', async () => {
      mockClient.rooms.add(`conversation:${validConversationId}`);

      const res = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: 'a'.repeat(2001),
      });

      expect(res.status).toBe('error');
      expect(res.error).toBe('Message content exceeds maximum length of 2000 characters');
      expect(chatService.saveMessage).not.toHaveBeenCalled();
    });

    // TEST 8: should return error and not broadcast if DB persistence fails
    it('should return error and NOT broadcast message:new if DB persistence fails', async () => {
      mockClient.rooms.add(`conversation:${validConversationId}`);
      chatService.getConversationById.mockResolvedValue(mockConversation);
      chatService.saveMessage.mockRejectedValue(new Error('MongoDB write timeout'));

      const res = await gateway.handleSendMessage(mockClient, {
        conversationId: validConversationId,
        content: 'Message failing persistence',
      });

      expect(res.status).toBe('error');
      expect(res.error).toBe('MongoDB write timeout');
      // Must NOT broadcast if DB write fails
      expect(mockRoomEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('should extract and verify user token on connection', async () => {
      const freshClient: any = {
        id: 'fresh-client-1',
        data: {},
        handshake: {
          auth: { token: 'jwt-auth-token' },
        },
      };

      jwtService.verify.mockReturnValue({
        sub: customerId,
        email: 'customer@test.com',
        role: 'customer',
      });

      await gateway.handleConnection(freshClient);

      expect(freshClient.data.user).toEqual({
        id: customerId,
        email: 'customer@test.com',
        role: 'customer',
      });
    });
  });
});
