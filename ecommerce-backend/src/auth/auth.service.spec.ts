import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { EventBusService } from '../shared/events/event-bus.service';
import { RedisService } from '../shared/database/redis.service';
import { OutboxService } from '../outbox/outbox.service';
import { CartService } from '../cart/cart.service';
import { User } from '../users/schemas/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: any;
  let jwtService: JwtService;
  let redisService: RedisService;
  let eventBus: EventBusService;

  const mockUser = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: 'customer',
    isActive: true,
    lastLoginAt: null,
    save: jest.fn().mockResolvedValue(true),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'auth.jwtRefreshExpiration': '7d',
        'auth.jwtAccessExpiration': '15m',
      };
      return config[key];
    }),
  };

  // Sessions are tracked in a Redis set per user, so the service reaches past the
  // JSON helpers to the raw client.
  const mockRedisClient = {
    sadd: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockRedisService = {
    setJson: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn(() => mockRedisClient),
  };

  const mockEventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  const mockOutbox = {
    publish: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(undefined),
  };

  // Login/register fold any guest cart into the user's; irrelevant to auth
  // behaviour, so it is stubbed and asserted separately in cart.service.spec.
  const mockCartService = {
    mergeGuestCart: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: OutboxService, useValue: mockOutbox },
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(User.name));
    jwtService = module.get(JwtService);
    redisService = module.get(RedisService);
    eventBus = module.get(EventBusService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'StrongP@ss1',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('user.registered', expect.any(Object));
      expect(mockRedisService.setJson).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'StrongP@ss1',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials and return tokens', async () => {
      const userWithPassword = {
        ...mockUser,
        select: jest.fn().mockReturnThis(),
      };
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'StrongP@ss1',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockUser.save).toHaveBeenCalled(); // lastLoginAt updated
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockUser, isActive: false }),
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'StrongP@ss1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens when refresh token is valid', async () => {
      mockRedisService.getJson.mockResolvedValue({ userId: '507f1f77bcf86cd799439011' });
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(mockRedisService.del).toHaveBeenCalled(); // Old token deleted
      expect(mockRedisService.setJson).toHaveBeenCalled(); // New token stored
    });

    it('should throw UnauthorizedException for expired/invalid refresh token', async () => {
      mockRedisService.getJson.mockResolvedValue(null);

      await expect(
        service.refreshToken('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockRedisService.getJson.mockResolvedValue({ userId: '507f1f77bcf86cd799439011' });
      mockUserModel.findById.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.refreshToken('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete the refresh token from Redis', async () => {
      await service.logout('some-refresh-token');
      expect(mockRedisService.del).toHaveBeenCalledWith(
        expect.stringContaining('some-refresh-token'),
      );
    });
  });

  describe('forgotPassword', () => {
    it('should always return success message (prevent enumeration)', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nobody@example.com' });
      expect(result.message).toContain('If that email exists');
    });

    it('should store reset token in Redis for valid user', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        expect.stringContaining('password_reset:'),
        expect.objectContaining({ userId: '507f1f77bcf86cd799439011' }),
        3600, // 1 hour TTL
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'password.reset_requested',
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      mockRedisService.getJson.mockResolvedValue({
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
      });
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewStr0ng!Pass',
      });

      expect(result.message).toContain('successfully');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockRedisService.del).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid/expired token', async () => {
      mockRedisService.getJson.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'expired', newPassword: 'NewStr0ng!Pass' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
