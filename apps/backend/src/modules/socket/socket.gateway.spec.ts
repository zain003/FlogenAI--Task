import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MarketplaceGateway } from './socket.gateway';
import { ServiceRequestEntity } from '../requests/interfaces/request.interface';

describe('MarketplaceGateway (WebSocket Handshake & Broadcasts)', () => {
  let gateway: MarketplaceGateway;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key-12345'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<MarketplaceGateway>(MarketplaceGateway);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Initialize mock Socket.IO server
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  const createMockSocket = (overrides?: any) => {
    return {
      id: 'socket-test-123',
      handshake: {
        auth: {},
        headers: {},
        ...overrides?.handshake,
      },
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    } as any;
  };

  // Test 1: should reject socket connection when handshake token is invalid or missing
  describe('Connection Authentication', () => {
    it('should reject socket connection when handshake token is missing', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, headers: {} },
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication token required',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should reject socket connection when token is invalid or expired', async () => {
      const client = createMockSocket({
        handshake: { auth: { token: 'invalid-expired-jwt' } },
      });

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized: Invalid authentication token',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    // Test 2: should authenticate provider socket and auto-join providers room
    it('should authenticate provider socket and auto-join providers room', async () => {
      const client = createMockSocket({
        handshake: { auth: { token: 'valid-provider-jwt' } },
      });

      mockJwtService.verify.mockReturnValue({
        sub: 'provider-user-456',
        email: 'provider@example.com',
        role: 'provider',
      });

      await gateway.handleConnection(client);

      expect(client.data.user).toEqual({
        id: 'provider-user-456',
        email: 'provider@example.com',
        role: 'provider',
      });
      expect(client.join).toHaveBeenCalledWith('providers');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate customer socket but NOT join providers room', async () => {
      const client = createMockSocket({
        handshake: {
          headers: { authorization: 'Bearer valid-customer-jwt' },
        },
      });

      mockJwtService.verify.mockReturnValue({
        sub: 'customer-user-123',
        email: 'customer@example.com',
        role: 'customer',
      });

      await gateway.handleConnection(client);

      expect(client.data.user).toEqual({
        id: 'customer-user-123',
        email: 'customer@example.com',
        role: 'customer',
      });
      expect(client.join).not.toHaveBeenCalledWith('providers');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  // Test 3: should broadcast request:created event to providers room when request is created
  describe('Event Broadcasts', () => {
    it('should broadcast request:created event to providers room when request is created', () => {
      const mockRequest: ServiceRequestEntity = {
        id: 'req-realtime-789',
        title: 'Emergency Generator Setup',
        description: 'Need commercial backup power installed within 24 hours.',
        budget: 1200,
        status: 'OPEN',
        customerId: 'customer-user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      gateway.emitRequestCreated(mockRequest);

      expect(gateway.server.to).toHaveBeenCalledWith('providers');
      expect(gateway.server.emit).toHaveBeenCalledWith('request:created', {
        request: mockRequest,
      });
    });
  });
});
