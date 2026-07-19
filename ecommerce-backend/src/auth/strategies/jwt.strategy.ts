import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';
import { RedisService } from '../../shared/database/redis.service';

const USER_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private authService: AuthService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    const cacheKey = `user_active:${payload.sub}`;

    // Check cache first to avoid hitting DB on every request
    const cached = await this.redis.getJson<{ isActive: boolean; role: string }>(cacheKey);

    if (cached !== null) {
      if (!cached.isActive) {
        throw new UnauthorizedException();
      }
      // Still need the full user object, but we can trust the cache for the active check
    }

    const user = await this.authService.validateUserById(payload.sub);
    if (!user || !user.isActive) {
      // Update cache to reflect inactive status
      if (user) {
        await this.redis.setJson(cacheKey, { isActive: false, role: user.role }, USER_CACHE_TTL);
      }
      throw new UnauthorizedException();
    }

    // Token-version check → instant revocation on logout-all / password reset.
    // Tokens minted before this field existed carry no `tv`; treat them as valid
    // (backward-compat) so a deploy doesn't force a mass re-login.
    if (payload.tv !== undefined && payload.tv !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Cache the active status
    await this.redis.setJson(cacheKey, { isActive: true, role: user.role }, USER_CACHE_TTL);

    return user;
  }
}
