import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MarketplaceGateway } from './socket.gateway';
import { ServiceRequestEntity } from '../requests/interfaces/request.interface';
import { OfferEntity } from '../offers/interfaces/offer.interface';

describe('MarketplaceGateway (WebSocket Handshake & Broadcasts)', () => {
  let gateway: MarketplaceGateway;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key-12345'),
  };

  const createMockSocket = (overrides?: any) => ({
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
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<MarketplaceGateway>(MarketplaceGateway);

    // Initialize mock Socket.IO server with chained .to().emit()
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    jest.clearAllMocks();
    // Re-apply server mock after clearAllMocks
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  // ─── Connection Authentication ──────────────────────────────────────────

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

    it('should authenticate provider and join both user private room and providers broadcast room', async () => {
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
      // Private room
      expect(client.join).toHaveBeenCalledWith('user:provider-user-456');
      // Broadcast room
      expect(client.join).toHaveBeenCalledWith('providers');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate customer and join user private room but NOT providers room', async () => {
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
      // Must join private room
      expect(client.join).toHaveBeenCalledWith('user:customer-user-123');
      // Must NOT join broadcast room
      expect(client.join).not.toHaveBeenCalledWith('providers');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  // ─── Event Broadcasts ───────────────────────────────────────────────────

  describe('Event Broadcasts', () => {
    // Test 1: request:created → providers room
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

    // Test 2: offer:created → customer private room
    it('should emit offer:created to customer personal room when offer is posted', () => {
      const customerId = 'customer-abc-111';
      const mockOffer: OfferEntity = {
        id: 'offer-new-222',
        requestId: 'req-789',
        providerId: 'provider-xyz-333',
        price: 350,
        message: 'I can complete this within 2 days with full materials included.',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      gateway.emitOfferCreated(customerId, mockOffer, 'Emergency Generator Setup');

      expect(gateway.server.to).toHaveBeenCalledWith(`user:${customerId}`);
      expect(gateway.server.emit).toHaveBeenCalledWith('offer:created', {
        offer: mockOffer,
        requestTitle: 'Emergency Generator Setup',
      });
    });

    // Test 3a: offer:accepted → winning provider private room
    it('should emit offer:accepted to selected provider room when offer is accepted', () => {
      const providerId = 'provider-xyz-333';
      const requestId = 'req-789';
      const mockOffer: OfferEntity = {
        id: 'offer-accepted-444',
        requestId,
        providerId,
        price: 350,
        message: 'Ready to start immediately.',
        status: 'ACCEPTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      gateway.emitOfferAccepted(providerId, mockOffer, requestId);

      expect(gateway.server.to).toHaveBeenCalledWith(`user:${providerId}`);
      expect(gateway.server.emit).toHaveBeenCalledWith('offer:accepted', {
        offer: mockOffer,
        requestId,
      });
    });

    // Test 3b: request:closed → providers room
    it('should broadcast request:closed to providers room when offer is accepted', () => {
      const providerId = 'provider-xyz-333';
      const requestId = 'req-789';
      const mockOffer: OfferEntity = {
        id: 'offer-accepted-444',
        requestId,
        providerId,
        price: 350,
        message: 'Ready to start immediately.',
        status: 'ACCEPTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      gateway.emitOfferAccepted(providerId, mockOffer, requestId);

      expect(gateway.server.to).toHaveBeenCalledWith('providers');
      expect(gateway.server.emit).toHaveBeenCalledWith('request:closed', {
        requestId,
      });
    });

    // Test 4: emitOfferAccepted emits two distinct events in total
    it('should emit exactly two events (offer:accepted + request:closed) on offer acceptance', () => {
      const providerId = 'provider-xyz-333';
      const requestId = 'req-789';
      const mockOffer: OfferEntity = {
        id: 'offer-accepted-444',
        requestId,
        providerId,
        price: 350,
        message: 'Ready to start immediately.',
        status: 'ACCEPTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      gateway.emitOfferAccepted(providerId, mockOffer, requestId);

      expect(gateway.server.emit).toHaveBeenCalledTimes(2);
    });
  });
});
