import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { Offer } from './schemas/offer.schema';
import { ServiceRequest } from '../requests/schemas/service-request.schema';
import { DistributedLockService } from '../redis/distributed-lock.service';
import { MarketplaceGateway } from '../socket/socket.gateway';

describe('OffersService (Domain Logic Unit Tests)', () => {
  let service: OffersService;
  let lockService: DistributedLockService;
  let mockGateway: jest.Mocked<Pick<MarketplaceGateway, 'emitOfferCreated' | 'emitOfferAccepted'>>;

  const mockDate = new Date('2026-09-25T14:00:00.000Z');
  const validRequestId = '65f1a1a1a1a1a1a1a1a1a1a1';
  const validOfferId1 = '65f2b2b2b2b2b2b2b2b2b2b2';
  const validOfferId2 = '65f3c3c3c3c3c3c3c3c3c3c3';
  const customerId = '507f1f77bcf86cd799439011';
  const providerId = '507f1f77bcf86cd799439022';
  const otherCustomerId = '507f1f77bcf86cd799439099';

  let mockRequestModel: any;
  let mockOfferModel: any;
  let mockLockService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockRequestModel = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    mockOfferModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: validOfferId1,
      createdAt: mockDate,
      updatedAt: mockDate,
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: validOfferId1,
        createdAt: mockDate,
        updatedAt: mockDate,
      }),
    }));

    mockOfferModel.find = jest.fn();
    mockOfferModel.findById = jest.fn();
    mockOfferModel.findByIdAndUpdate = jest.fn();
    mockOfferModel.updateMany = jest.fn();
    mockOfferModel.countDocuments = jest.fn();

    mockLockService = {
      acquire: jest.fn().mockResolvedValue('test-lock-token-123'),
      release: jest.fn().mockResolvedValue(true),
    };

    mockGateway = {
      emitOfferCreated: jest.fn(),
      emitOfferAccepted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        {
          provide: getModelToken(Offer.name),
          useValue: mockOfferModel,
        },
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
        {
          provide: DistributedLockService,
          useValue: mockLockService,
        },
        {
          provide: MarketplaceGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    lockService = module.get<DistributedLockService>(DistributedLockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOffer', () => {
    it('should allow authenticated provider to submit offer on open request', async () => {
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          status: 'OPEN',
          customerId: customerId,
        }),
      });

      const dto = {
        price: 250,
        message: 'I can complete this HVAC maintenance on Saturday morning.',
      };

      const result = await service.createOffer(validRequestId, providerId, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(validOfferId1);
      expect(result.requestId).toBe(validRequestId);
      expect(result.providerId).toBe(providerId);
      expect(result.price).toBe(250);
      expect(result.message).toBe(dto.message);
      expect(result.status).toBe('PENDING');
    });

    it('should reject offer submission on non-existent request with HTTP 404', async () => {
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createOffer(validRequestId, providerId, {
          price: 250,
          message: 'Valid message for non-existent job',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject offer submission on closed or accepted request with HTTP 400', async () => {
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          status: 'ACCEPTED',
          customerId: customerId,
        }),
      });

      await expect(
        service.createOffer(validRequestId, providerId, {
          price: 250,
          message: 'Offering on accepted job',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject offer submission if customer attempts to offer on their own request with HTTP 400', async () => {
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          status: 'OPEN',
          customerId: customerId,
        }),
      });

      await expect(
        service.createOffer(validRequestId, customerId, {
          price: 150,
          message: 'Customer bidding on self',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject offer submission with invalid requestId format with HTTP 400', async () => {
      await expect(
        service.createOffer('invalid-id', providerId, {
          price: 200,
          message: 'Valid message',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // FEAT-003-INT: emitOfferCreated dispatched to customer room after offer creation
    it('should call gateway.emitOfferCreated with customerId, offer, and requestTitle after offer is created', async () => {
      const requestTitle = 'Emergency HVAC Maintenance';
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          status: 'OPEN',
          customerId: customerId,
          title: requestTitle,
          toString: () => customerId,
        }),
      });

      await service.createOffer(validRequestId, providerId, {
        price: 275,
        message: 'Ready to start on Monday with full gear.',
      });

      expect(mockGateway.emitOfferCreated).toHaveBeenCalledTimes(1);
      const [calledCustomerId, calledOffer, calledTitle] = mockGateway.emitOfferCreated.mock.calls[0];
      expect(calledCustomerId).toBe(customerId);
      expect(calledOffer.status).toBe('PENDING');
      expect(calledTitle).toBe(requestTitle);
    });
  });

  describe('findOffersByRequest', () => {
    it('should return paginated offers for a valid request', async () => {
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: validRequestId }),
      });

      mockOfferModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const mockOfferDocs = [
        {
          _id: validOfferId1,
          requestId: validRequestId,
          providerId: providerId,
          price: 250,
          message: 'HVAC repair proposal',
          status: 'PENDING',
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ];

      mockOfferModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockOfferDocs),
              }),
            }),
          }),
        }),
      });

      const result = await service.findOffersByRequest(validRequestId, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(validOfferId1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should throw NotFoundException if request does not exist', async () => {
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOffersByRequest(validRequestId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('acceptOffer', () => {
    it('should allow customer who owns request to accept an offer with HTTP 200 and release lock', async () => {
      // 1. Offer lookup
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          providerId: providerId,
          price: 250,
          message: 'HVAC repair proposal',
          status: 'PENDING',
          createdAt: mockDate,
          updatedAt: mockDate,
        }),
      });

      // 2. Request lookup
      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          customerId: customerId,
          status: 'OPEN',
        }),
      });

      // 3. Atomic MongoDB mutation
      mockRequestModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          status: 'ACCEPTED',
          acceptedOfferId: validOfferId1,
        }),
      });

      // 4. Update winning offer
      mockOfferModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          providerId: providerId,
          price: 250,
          message: 'HVAC repair proposal',
          status: 'ACCEPTED',
          createdAt: mockDate,
          updatedAt: mockDate,
        }),
      });

      // 5. Reject peer offers
      mockOfferModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      const response = await service.acceptOffer(validOfferId1, customerId);

      expect(response.success).toBe(true);
      expect(response.offer.status).toBe('ACCEPTED');
      expect(response.paymentPending).toBe(true);

      // Verify distributed lock acquired and released
      expect(mockLockService.acquire).toHaveBeenCalledWith(
        `mkt:lock:request:${validRequestId}`,
        10000,
      );
      expect(mockLockService.release).toHaveBeenCalledWith(
        `mkt:lock:request:${validRequestId}`,
        'test-lock-token-123',
      );

      // Verify atomic update checked status 'OPEN'
      expect(mockRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: validRequestId, status: 'OPEN' },
        { $set: { status: 'ACCEPTED', acceptedOfferId: validOfferId1 } },
        { new: true },
      );

      // Verify peer offers rejected
      expect(mockOfferModel.updateMany).toHaveBeenCalledWith(
        {
          requestId: validRequestId,
          _id: { $ne: validOfferId1 },
          status: 'PENDING',
        },
        { $set: { status: 'REJECTED' } },
      );

      // FEAT-003-INT: gateway emitOfferAccepted dispatched to winning provider
      expect(mockGateway.emitOfferAccepted).toHaveBeenCalledTimes(1);
      const [calledProviderId, calledOffer, calledRequestId] = mockGateway.emitOfferAccepted.mock.calls[0];
      expect(calledProviderId).toBe(providerId);
      expect(calledOffer.status).toBe('ACCEPTED');
      expect(calledRequestId).toBeDefined();
    });

    it('should reject offer acceptance with HTTP 409 when Redis lock cannot be acquired', async () => {
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          status: 'PENDING',
        }),
      });

      // Lock acquisition fails (another instance holds it)
      mockLockService.acquire.mockResolvedValue(null);

      await expect(service.acceptOffer(validOfferId1, customerId)).rejects.toThrow(
        ConflictException,
      );

      expect(mockLockService.acquire).toHaveBeenCalled();
      expect(mockRequestModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should reject offer acceptance by a user who does not own the request with HTTP 403', async () => {
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          status: 'PENDING',
        }),
      });

      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          customerId: customerId, // owned by customerId, but called by otherCustomerId
          status: 'OPEN',
        }),
      });

      await expect(
        service.acceptOffer(validOfferId1, otherCustomerId),
      ).rejects.toThrow(ForbiddenException);

      // Lock must be released even on error
      expect(mockLockService.release).toHaveBeenCalled();
    });

    it('should reject offer acceptance with HTTP 409 if request is already accepted', async () => {
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          status: 'PENDING',
        }),
      });

      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          customerId: customerId,
          status: 'ACCEPTED', // Already accepted
        }),
      });

      await expect(service.acceptOffer(validOfferId1, customerId)).rejects.toThrow(
        ConflictException,
      );

      expect(mockLockService.release).toHaveBeenCalled();
    });

    it('should reject offer acceptance with HTTP 409 if atomic findOneAndUpdate returns null (race lost)', async () => {
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          status: 'PENDING',
        }),
      });

      mockRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validRequestId,
          customerId: customerId,
          status: 'OPEN',
        }),
      });

      // Atomic conditional update returns null (another process slipped in and updated status)
      mockRequestModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.acceptOffer(validOfferId1, customerId)).rejects.toThrow(
        ConflictException,
      );

      expect(mockLockService.release).toHaveBeenCalled();
    });

    it('should reject acceptance of an already accepted or rejected offer with HTTP 400', async () => {
      mockOfferModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validOfferId1,
          requestId: validRequestId,
          status: 'REJECTED',
        }),
      });

      await expect(service.acceptOffer(validOfferId1, customerId)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockLockService.acquire).not.toHaveBeenCalled();
    });
  });
});
