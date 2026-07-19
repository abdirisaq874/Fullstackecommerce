import {
  Injectable, CanActivate, ExecutionContext, SetMetadata, createParamDecorator, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StoresService, ActiveStoreContext } from '../stores.service';
import { StoreRole } from '../schemas/store-membership.schema';

const ROLE_RANK: Record<StoreRole, number> = {
  [StoreRole.OWNER]: 3,
  [StoreRole.MANAGER]: 2,
  [StoreRole.STAFF]: 1,
};

// Declare the minimum store role a handler needs (hierarchy: owner>manager>staff).
export const STORE_ROLES_KEY = 'store_roles';
export const StoreRoles = (...roles: StoreRole[]) => SetMetadata(STORE_ROLES_KEY, roles);

/** Injects the resolved active-store context (`{ storeId, role }`) into a handler. */
export const ActiveStore = createParamDecorator(
  (data: keyof ActiveStoreContext | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const sc: ActiveStoreContext | undefined = req.storeContext;
    return data ? sc?.[data] : sc;
  },
);

/**
 * Resolves the active store from the `X-Store-Id` header (falling back to the
 * user's default store), verifies LIVE membership, enforces any `@StoreRoles`,
 * and attaches `req.storeContext`. MUST run after JwtAuthGuard (needs req.user).
 */
@Injectable()
export class StoreContextGuard implements CanActivate {
  constructor(
    private readonly stores: StoresService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const header = (req.headers['x-store-id'] as string | undefined)?.trim() || undefined;
    const context = await this.stores.resolveActiveStore(user._id.toString(), header);

    const required = this.reflector.getAllAndOverride<StoreRole[]>(STORE_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (required && required.length) {
      const min = Math.min(...required.map((r) => ROLE_RANK[r]));
      if (ROLE_RANK[context.role] < min) {
        throw new ForbiddenException('Insufficient store role for this action');
      }
    }

    req.storeContext = context;
    return true;
  }
}
