import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockUserDoc = {
    _id: '507f1f77bcf86cd799439011',
    email: 'customer@test.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    name: 'Test Customer',
    role: 'customer' as const,
    createdAt: new Date('2026-09-25T12:00:00.000Z'),
    updatedAt: new Date('2026-09-25T12:00:00.000Z'),
    save: jest.fn(),
  };

  const mockUserModel: any = jest.fn().mockImplementation((dto) => ({
    ...dto,
    _id: mockUserDoc._id,
    save: jest.fn().mockResolvedValue({
      ...mockUserDoc,
      ...dto,
    }),
  }));

  mockUserModel.findOne = jest.fn();
  mockUserModel.findById = jest.fn();

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a new customer and return JWT with HTTP 201', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const registerDto = {
        email: 'customer@test.com',
        password: 'Password123!',
        name: 'Test Customer',
        role: 'customer' as const,
      };

      const result = await service.register(registerDto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'customer@test.com',
      });
      expect(result).toHaveProperty('accessToken', 'mock.jwt.token');
      expect(result.user).toEqual({
        id: mockUserDoc._id,
        email: 'customer@test.com',
        name: 'Test Customer',
        role: 'customer',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUserDoc._id,
        email: 'customer@test.com',
        role: 'customer',
      });
    });

    it('should trim and normalize email to lowercase', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const registerDto = {
        email: '  CUSTOMER_UPPER@TEST.COM  ',
        password: 'Password123!',
        name: '  Test Customer  ',
        role: 'customer' as const,
      };

      await service.register(registerDto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'customer_upper@test.com',
      });
    });

    it('should reject registration with duplicate email with HTTP 409 Conflict', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      });

      const registerDto = {
        email: 'customer@test.com',
        password: 'Password123!',
        name: 'Test Customer',
        role: 'customer' as const,
      };

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle MongoDB duplicate key error (code 11000) and throw 409 Conflict', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockUserModel.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue({ code: 11000 }),
      }));

      const registerDto = {
        email: 'customer@test.com',
        password: 'Password123!',
        name: 'Test Customer',
        role: 'customer' as const,
      };

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should authenticate valid credentials and return signed JWT with HTTP 200', async () => {
      const realHash = await bcrypt.hash('Password123!', 10);
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          passwordHash: realHash,
        }),
      });

      const loginDto = {
        email: 'customer@test.com',
        password: 'Password123!',
      };

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock.jwt.token');
      expect(result.user.email).toBe('customer@test.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with wrong password with HTTP 401 Unauthorized', async () => {
      const realHash = await bcrypt.hash('Password123!', 10);
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          passwordHash: realHash,
        }),
      });

      const loginDto = {
        email: 'customer@test.com',
        password: 'WrongPassword!',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject login when user email does not exist with HTTP 401 Unauthorized', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const loginDto = {
        email: 'nonexistent@test.com',
        password: 'Password123!',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile without passwordHash for valid userId', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      });

      const profile = await service.getProfile(mockUserDoc._id);

      expect(profile).toEqual({
        id: mockUserDoc._id,
        email: mockUserDoc.email,
        name: mockUserDoc.name,
        role: mockUserDoc.role,
        createdAt: mockUserDoc.createdAt.toISOString(),
        updatedAt: mockUserDoc.updatedAt.toISOString(),
      });
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getProfile('507f1f77bcf86cd799439999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
