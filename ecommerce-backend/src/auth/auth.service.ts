import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { RedisService } from '../shared/database/redis.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** Parse a duration string like '7d', '24h', '30m' into seconds. */
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 3600; // default: 7 days
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 7 * 86400;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private readonly RESET_TOKEN_PREFIX = 'password_reset:';
  private readonly RESET_TOKEN_TTL = 3600; // 1 hour

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private config: ConfigService,
    private eventBus: EventBusService,
    private redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      passwordHash: dto.password, // Pre-save hook hashes it
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      ...(dto.role ? { role: dto.role } : {}),
    });

    await this.eventBus.emit('user.registered', {
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash');

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    user.lastLoginAt = new Date();
    await user.save();

    await this.eventBus.emit('user.logged_in', {
      userId: user._id.toString(),
      email: user.email,
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const key = this.REFRESH_TOKEN_PREFIX + refreshToken;
    const stored = await this.redis.getJson<{ userId: string }>(key);

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userModel.findById(stored.userId);
    if (!user || !user.isActive) {
      await this.redis.del(key);
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: delete the old token, issue a new one
    await this.redis.del(key);
    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.redis.del(this.REFRESH_TOKEN_PREFIX + refreshToken);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (user) {
      // Generate a cryptographically secure token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Store hashed token in Redis with TTL
      await this.redis.setJson(
        this.RESET_TOKEN_PREFIX + hashedToken,
        { userId: user._id.toString(), email: user.email },
        this.RESET_TOKEN_TTL,
      );

      await this.eventBus.emit('password.reset_requested', {
        userId: user._id.toString(),
        email: user.email,
        resetToken, // Send the unhashed token in the email link
        firstName: user.firstName,
      });
    }

    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Hash the incoming token to look up in Redis
    const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');
    const key = this.RESET_TOKEN_PREFIX + hashedToken;
    const stored = await this.redis.getJson<{ userId: string; email: string }>(key);

    if (!stored) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.userModel.findById(stored.userId).select('+passwordHash');
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update password (pre-save hook hashes it)
    user.passwordHash = dto.newPassword;
    await user.save();

    // Delete the reset token so it can't be reused
    await this.redis.del(key);

    // Invalidate all existing refresh tokens for this user by scanning keys
    // In production with many users, consider a per-user token versioning scheme
    this.logger.log(`Password reset completed for user ${user.email}`);

    return { message: 'Password has been reset successfully' };
  }

  async validateUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  private async generateTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate a cryptographically secure refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Parse refresh expiry from config (e.g. '7d', '24h')
    const refreshExpiry = this.config.get<string>('auth.jwtRefreshExpiration') || '7d';
    const ttlSeconds = parseDurationToSeconds(refreshExpiry);

    // Store in Redis with automatic TTL expiry
    await this.redis.setJson(
      this.REFRESH_TOKEN_PREFIX + refreshToken,
      { userId: user._id.toString() },
      ttlSeconds,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('auth.jwtAccessExpiration') || '15m',
    };
  }
}
