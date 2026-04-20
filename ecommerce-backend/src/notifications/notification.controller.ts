// ─── notification.controller.ts ───
import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { PaginationDto } from '../shared/database/pagination.dto';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Get my notifications' })
  async list(
    @CurrentUser('_id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.notificationService.getUserNotifications(userId, pagination);
  }

  @Get('unread-count')
  @Auth()
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@CurrentUser('_id') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @Auth()
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
  ) {
    await this.notificationService.markAsRead(id, userId);
    return { message: 'Marked as read' };
  }
}
