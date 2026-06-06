import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  createParamDecorator,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderService } from '../order.service';
import { OrderDocument } from '../schemas/order.schema';
import { UserRole } from '../../users/schemas/user.schema';
import { idsEqual } from '../../shared/utils/helpers';

/**
 * Ownership guard ("middleman") for single-order routes.
 *
 * Runs after JwtAuthGuard (so `request.user` is populated) and decides whether
 * the authenticated caller may access the order named by the `:id` param:
 *   - the owner of the order, or
 *   - an admin.
 *
 * On denial it throws NotFound (not Forbidden) so a non-owner cannot confirm
 * that someone else's order exists — this also closes ID enumeration.
 *
 * The loaded order is stashed on the request (`request.order`) so the route
 * handler can reuse it via @LoadedOrder() instead of fetching it a second time.
 */
@Injectable()
export class OrderOwnershipGuard implements CanActivate {
  constructor(private readonly orderService: OrderService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orderId: string = request.params?.id;

    // Guards run before pipes, so ParseObjectIdPipe hasn't validated the id yet.
    // Treat a malformed id as "not found" to avoid a Mongoose CastError (500).
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }

    const order = await this.orderService.findById(orderId);

    const isOwner = idsEqual(order.userId, user._id);
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new NotFoundException('Order not found');
    }

    // Reuse in the handler — avoids a duplicate DB read.
    request.order = order;
    return true;
  }
}

/**
 * Injects the order loaded and authorized by OrderOwnershipGuard.
 * Only valid on routes protected by that guard.
 */
export const LoadedOrder = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrderDocument =>
    ctx.switchToHttp().getRequest().order,
);
