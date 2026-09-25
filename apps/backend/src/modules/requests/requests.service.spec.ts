import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RequestsService } from './requests.service';
import { ServiceRequest } from './schemas/service-request.schema';

describe('RequestsService (Domain Logic Unit Tests)', () => {
  let service: RequestsService;

  const mockDate = new Date('2026-09-25T12:00:00.000Z');

  const mockRawRequestDoc = {
    _id: '65f1a1a1a1a1a1a1a1a1a1a1',
    title: 'Need HVAC Repair',
    description: 'Central air conditioning unit is blowing warm air.',
    budget: 350,
    status: 'OPEN',
    customerId: '507f1f77bcf86cd799439011',
    acceptedOfferId: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    save: jest.fn(),
  };

  const mockRequestModel: any = jest.fn().mockImplementation((dto) => ({
    ...dto,
    _id: '65f1a1a1a1a1a1a1a1a1a1a1',
    save: jest.fn().mockResolvedValue({
      ...dto,
      _id: '65f1a1a1a1a1a1a1a1a1a1a1',
      createdAt: mockDate,
      updatedAt: mockDate,
    }),
  }));

  mockRequestModel.find = jest.fn();
  mockRequestModel.findById = jest.fn();
  mockRequestModel.countDocuments = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getModelToken(ServiceRequest.name),
          useValue: mockRequestModel,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a service request with status OPEN and link customerId', async () => {
      const customerId = '507f1f77bcf86cd799439011';
      const dto = {
        title: ' Need HVAC Repair ',
        description: ' Central air conditioning unit is blowing warm air. ',
        budget: 350,
      };

      const result = await service.create(customerId, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('65f1a1a1a1a1a1a1a1a1a1a1');
      expect(result.title).toBe('Need HVAC Repair');
      expect(result.description).toBe('Central air conditioning unit is blowing warm air.');
      expect(result.budget).toBe(350);
      expect(result.status).toBe('OPEN');
      expect(result.customerId).toBe(customerId);
      expect(result.acceptedOfferId).toBeNull();
      expect(result.createdAt).toBe(mockDate.toISOString());
    });

    it('should emit request:created via MarketplaceGateway when gateway is injected', async () => {
      const mockGateway = {
        emitRequestCreated: jest.fn(),
      };

      const customService = new RequestsService(mockRequestModel, mockGateway as any);
      const customerId = '507f1f77bcf86cd799439011';
      const dto = {
        title: 'Electrical Rewiring',
        description: 'Need full residential breaker panel rewiring.',
        budget: 600,
      };

      const result = await customService.create(customerId, dto);

      expect(mockGateway.emitRequestCreated).toHaveBeenCalledWith(result);
    });
  });

  describe('findAll', () => {
    it('should query requests with pagination metadata and status filter', async () => {
      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRawRequestDoc]),
      };

      mockRequestModel.find.mockReturnValue(mockQueryChain);
      mockRequestModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({
        page: 1,
        limit: 20,
        status: 'OPEN',
      });

      expect(mockRequestModel.find).toHaveBeenCalledWith({ status: 'OPEN' });
      expect(mockRequestModel.countDocuments).toHaveBeenCalledWith({ status: 'OPEN' });
      expect(mockQueryChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockQueryChain.skip).toHaveBeenCalledWith(0);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('65f1a1a1a1a1a1a1a1a1a1a1');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should cap limit at 50 if query requests more than 50', async () => {
      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockRequestModel.find.mockReturnValue(mockQueryChain);
      mockRequestModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.findAll({
        page: 1,
        limit: 100,
      });

      expect(mockQueryChain.limit).toHaveBeenCalledWith(50);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('findByCustomer', () => {
    it('should return paginated requests filtered by customerId', async () => {
      const customerId = '507f1f77bcf86cd799439011';
      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRawRequestDoc]),
      };

      mockRequestModel.find.mockReturnValue(mockQueryChain);
      mockRequestModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findByCustomer(customerId, { page: 1, limit: 10 });

      expect(mockRequestModel.find).toHaveBeenCalledWith({ customerId });
      expect(mockRequestModel.countDocuments).toHaveBeenCalledWith({ customerId });
      expect(mockQueryChain.skip).toHaveBeenCalledWith(0);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(10);
      expect(result.data[0].customerId).toBe(customerId);
    });
  });

  describe('findById', () => {
    it('should return request entity if document exists', async () => {
      const id = '65f1a1a1a1a1a1a1a1a1a1a1';
      mockRequestModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRawRequestDoc),
      });

      const result = await service.findById(id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(id);
      expect(result?.title).toBe('Need HVAC Repair');
    });

    it('should return null if document does not exist', async () => {
      const id = '65f1a1a1a1a1a1a1a1a1a1a1';
      mockRequestModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findById(id);

      expect(result).toBeNull();
    });

    it('should return null if invalid ObjectId passed', async () => {
      const result = await service.findById('invalid-id');
      expect(result).toBeNull();
      expect(mockRequestModel.findById).not.toHaveBeenCalled();
    });
  });
});
