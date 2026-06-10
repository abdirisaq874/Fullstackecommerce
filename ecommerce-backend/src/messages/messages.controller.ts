import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import {
  CreateThreadDto, ReplyMessageDto, ThreadQueryDto, ThreadMessagesQueryDto,
} from './dto/messages.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List my threads (seller or customer)' })
  @ApiResponse({ status: 200, description: 'Paginated list of threads I participate in' })
  async listThreads(
    @CurrentUser('_id') userId: string,
    @Query() query: ThreadQueryDto,
  ) {
    return this.messagesService.listThreads(userId, query);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get a single thread with paginated messages' })
  @ApiQuery({ name: 'messagePage', required: false, type: Number })
  @ApiQuery({ name: 'messageLimit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Thread detail + messages page' })
  @ApiResponse({ status: 403, description: 'Not a participant of this thread' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async getThread(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @Query() query: ThreadMessagesQueryDto,
  ) {
    return this.messagesService.getThread(
      userId,
      id,
      query.messagePage,
      query.messageLimit,
    );
  }

  @Post('threads')
  @ApiOperation({ summary: 'Start a new thread with a first message' })
  @ApiResponse({ status: 201, description: 'Thread + first message created' })
  async createThread(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateThreadDto,
  ) {
    return this.messagesService.createThread(userId, dto);
  }

  @Post('threads/:id/messages')
  @ApiOperation({ summary: 'Reply to a thread' })
  @ApiResponse({ status: 201, description: 'New message appended to thread' })
  @ApiResponse({ status: 403, description: 'Not a participant of this thread' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async reply(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @Body() dto: ReplyMessageDto,
  ) {
    return this.messagesService.reply(userId, id, dto);
  }

  @Patch('threads/:id/read')
  @ApiOperation({ summary: 'Mark all messages in a thread as read for me' })
  @ApiResponse({ status: 200, description: 'Unread counter reset; messages stamped read' })
  @ApiResponse({ status: 403, description: 'Not a participant of this thread' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async markRead(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
  ) {
    return this.messagesService.markRead(userId, id);
  }
}
