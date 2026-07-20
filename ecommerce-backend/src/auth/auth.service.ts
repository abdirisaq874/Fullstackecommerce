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
import { OutboxService } from '../outbox/outbox.service';
import { EmailEventType } from '../shared/events/email-event.enum';
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
  /** token version — must equal the user's current `tokenVersion` (revocation). */
  tv?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** What we persist (in Redis) for a live refresh token, keyed by its hash. */
interface RefreshRecord {
  userId: string;
  sessionId: string;
  /** the user's tokenVersion at issue time; a bump (logout-all / reset) kills it. */
  tv?: number;
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

  private readonly LEGACY_REFRESH_PREFIX = 'refresh_token:'; // pre-session-model tokens
  private readonly REFRESH_PREFIX = 'refresh:'; // refresh:<sha256(token)> → RefreshRecord
  private readonly USED_PREFIX = 'refresh_used:'; // atomic one-time-use consume marker
  private readonly SESSION_PREFIX = 'session:'; // session:<sessionId> → { userId, ... }
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:'; // set of sessionIds per user
  private readonly RESET_TOKEN_PREFIX = 'password_reset:';
  private readonly RESET_TOKEN_TTL = 3600; // 1 hour
  private readonly EMAIL_VERIFY_PREFIX = 'email_verify:';
  private readonly EMAIL_VERIFY_TTL = 86400; // 24 hours

  private sha(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  private refreshTtl(): number {
    return parseDurationToSeconds(this.config.get<string>('auth.jwtRefreshExpiration') || '7d');
  }

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private config: ConfigService,
    private eventBus: EventBusService,
    private redis: RedisService,
    private outbox: OutboxService,
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

    // Send an email-verification link (best-effort — must never block signup).
    try {
      await this.issueEmailVerification(user);
    } catch (e) {
      this.logger.warn(`verification email publish failed: ${(e as Error).message}`);
    }

    return this.createSession(user);
  }

  /** Mint a verification token, stash the hash in Redis, and queue the email. */
  private async issueEmailVerification(user: {
    _id: { toString(): string };
    email: string;
    firstName: string;
  }): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.redis.setJson(
      this.EMAIL_VERIFY_PREFIX + hashedToken,
      { userId: user._id.toString(), email: user.email },
      this.EMAIL_VERIFY_TTL,
    );
    await this.outbox.publish({
      eventType: EmailEventType.AUTH_EMAIL_VERIFY,
      aggregateType: 'user',
      aggregateId: user._id.toString(),
      idempotencyKey: `auth.email.verify:${hashedToken}`,
      payload: { recipientEmail: user.email, name: user.firstName, token: rawToken },
    });
  }

  /** Verify an email address from the link's token. */
  async verifyEmail(dto: { token: string }): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');
    const key = this.EMAIL_VERIFY_PREFIX + hashedToken;
    const stored = await this.redis.getJson<{ userId: string; email: string }>(key);
    if (!stored) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.userModel.updateOne({ _id: stored.userId }, { $set: { emailVerified: true } });
    await this.redis.del(key);
    return { message: 'Email verified successfully' };
  }

  /** Re-send the verification email (enumeration-safe). */
  async resendVerification(dto: { email: string }): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (user && !user.emailVerified) {
      try {
        await this.issueEmailVerification(user);
      } catch (e) {
        this.logger.warn(`resend verification failed: ${(e as Error).message}`);
      }
    }
    return { message: 'If that account exists and is unverified, a verification email has been sent' };
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

    return this.createSession(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const hash = this.sha(refreshToken);
    const client = this.redis.getClient();
    const rec = await this.redis.getJson<RefreshRecord>(this.REFRESH_PREFIX + hash);

    if (!rec) {
      // Backward-compat: honor a pre-session-model token once, migrating it to a
      // fresh session so users aren't logged out across the deploy — BUT never
      // after a revocation. A logout-all / password-reset bumps tokenVersion, so
      // a non-zero version means every prior (incl. legacy) token is dead.
      const legacyKey = this.LEGACY_REFRESH_PREFIX + refreshToken;
      const legacy = await this.redis.getJson<{ userId: string }>(legacyKey);
      if (legacy) {
        await this.redis.del(legacyKey);
        const u = await this.userModel.findById(legacy.userId);
        if (!u || !u.isActive) throw new UnauthorizedException('User not found or inactive');
        if ((u.tokenVersion ?? 0) !== 0) {
          throw new UnauthorizedException('Session has been revoked; please sign in again');
        }
        return this.createSession(u);
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Atomic one-time consume: the FIRST caller sets the marker (SET NX). Any
    // later presentation of the same token loses the race → reuse → revoke the
    // whole session (defeats replay of a stolen/rotated token; race-free).
    const won = await client.set(this.USED_PREFIX + hash, '1', 'EX', this.refreshTtl(), 'NX');
    if (won !== 'OK') {
      await this.revokeSession(rec.userId, rec.sessionId);
      this.logger.warn(`Refresh-token reuse detected for user ${rec.userId}; session revoked`);
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    }

    // The session must still exist (logout / reuse deletes it).
    const session = await this.redis.getJson<{ userId: string }>(this.SESSION_PREFIX + rec.sessionId);
    if (!session) throw new UnauthorizedException('Session has been revoked');

    const user = await this.userModel.findById(rec.userId);
    if (!user || !user.isActive) {
      await this.revokeSession(rec.userId, rec.sessionId);
      throw new UnauthorizedException('User not found or inactive');
    }

    // Authoritative revocation, independent of the enumeration set: if a
    // logout-all / password reset advanced tokenVersion, this session is dead.
    if ((rec.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      await this.revokeSession(rec.userId, rec.sessionId);
      throw new UnauthorizedException('Session has been revoked');
    }

    return this.issueForSession(user, rec.sessionId);
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.sha(refreshToken);
    const rec = await this.redis.getJson<RefreshRecord>(this.REFRESH_PREFIX + hash);
    if (rec) {
      await this.revokeSession(rec.userId, rec.sessionId);
      await this.redis.del(this.REFRESH_PREFIX + hash);
    }
    // also clear any legacy token
    await this.redis.del(this.LEGACY_REFRESH_PREFIX + refreshToken);
  }

  /** Log out of every session and invalidate all outstanding access tokens. */
  async logoutAll(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const setKey = this.USER_SESSIONS_PREFIX + userId;
    const sessionIds = await client.smembers(setKey);
    await Promise.all(sessionIds.map((sid) => this.redis.del(this.SESSION_PREFIX + sid)));
    await this.redis.del(setKey);
    // Bump tokenVersion → JwtStrategy rejects all currently-issued access tokens.
    await this.userModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  }

  private async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(this.SESSION_PREFIX + sessionId);
    await this.redis.getClient().srem(this.USER_SESSIONS_PREFIX + userId, sessionId);
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

      // Password-reset email (best-effort; unique key per request so it always sends).
      try {
        await this.outbox.publish({
          eventType: EmailEventType.AUTH_PASSWORD_RESET,
          aggregateType: 'user',
          aggregateId: user._id.toString(),
          idempotencyKey: `auth.password.reset:${hashedToken}`,
          payload: { recipientEmail: user.email, name: user.firstName, token: resetToken },
        });
      } catch (e) {
        this.logger.warn(`password-reset email publish failed: ${(e as Error).message}`);
      }
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

    // Revoke every session + bump tokenVersion so all outstanding access AND
    // refresh tokens for this user are immediately invalidated.
    await this.logoutAll(user._id.toString());
    this.logger.log(`Password reset completed for user ${user.email}; all sessions revoked`);

    return { message: 'Password has been reset successfully' };
  }

  async validateUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  /** Start a brand-new session (login / register / legacy migration). */
  private async createSession(user: UserDocument): Promise<AuthTokens> {
    const sessionId = crypto.randomBytes(16).toString('hex');
    return this.issueForSession(user, sessionId);
  }

  /**
   * Mint an access+refresh pair bound to an (existing or new) session, and
   * (re)assert the session record, index membership AND index TTL — so a
   * continuously-rotated session can never outlive the `user_sessions` set that
   * logout-all relies on. The access token + refresh record carry `tv` for
   * authoritative revocation.
   */
  private async issueForSession(user: UserDocument, sessionId: string): Promise<AuthTokens> {
    const uid = user._id.toString();
    const tv = user.tokenVersion ?? 0;
    const payload: JwtPayload = { sub: uid, email: user.email, role: user.role, tv };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const ttl = this.refreshTtl();
    await this.redis.setJson(this.REFRESH_PREFIX + this.sha(refreshToken), { userId: uid, sessionId, tv }, ttl);
    await this.redis.setJson(this.SESSION_PREFIX + sessionId, { userId: uid, lastUsedAt: Date.now() }, ttl);
    const client = this.redis.getClient();
    await client.sadd(this.USER_SESSIONS_PREFIX + uid, sessionId);
    await client.expire(this.USER_SESSIONS_PREFIX + uid, ttl);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('auth.jwtAccessExpiration') || '15m',
    };
  }
}
