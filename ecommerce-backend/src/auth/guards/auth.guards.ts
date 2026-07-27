import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';

// ─── JWT Auth Guard ───
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ─── Optional JWT Auth Guard ───
// Populates req.user when a valid Bearer token is present, but NEVER rejects —
// so a route works for guests and logged-in users alike (used for personalization
// that gracefully degrades to non-personalized for anonymous visitors).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user || undefined;
  }
}

// ─── Roles Decorator ───
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// ─── Roles Guard ───
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles specified (e.g. bare @Auth()) → any authenticated user is allowed.
    // Note: an empty array is truthy, so we must also check length here.
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// ─── Current User Decorator ───
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!data) return user;

    const value = user?.[data];
    // Normalize Mongo ObjectIds (e.g. @CurrentUser('_id')) to plain strings so
    // every consumer gets a stable primitive instead of an ObjectId. This keeps
    // ownership comparisons and query building consistent across the codebase.
    return value instanceof Types.ObjectId ? value.toString() : value;
  },
);

// ─── Composite Auth Decorator ───
export function Auth(...roles: string[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth(),
  );
}

// ─── Optional Auth Decorator ───
// Attaches the user if authenticated; allows guests through otherwise.
export function OptionalAuth() {
  return applyDecorators(UseGuards(OptionalJwtAuthGuard), ApiBearerAuth());
}
