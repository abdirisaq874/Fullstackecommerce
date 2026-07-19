import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/auth.guards';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { PaginationDto } from '../shared/database/pagination.dto';
import { ReturnsService } from './returns.service';
import {
  CreateReturnDto,
  RecordInspectionDto,
  ReturnQueryDto,
  UpdateReturnStatusDto,
} from './dto/return.dto';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  // ═══════════════════════════════════════════
  // CUSTOMER (any authenticated user)
  // ═══════════════════════════════════════════

  @Post('/')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer creates a return request for their order' })
  @ApiResponse({ status: 201, description: 'Return created in `requested` state' })
  @ApiResponse({ status: 400, description: 'Invalid items / SKUs / quantities' })
  @ApiResponse({ status: 404, description: 'Order not found or not owned by caller' })
  async create(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returnsService.create(userId, dto);
  }

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List the current user's returns" })
  @ApiResponse({ status: 200, description: 'Paginated list of returns' })
  async listMine(
    @CurrentUser('_id') userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.returnsService.listForUser(userId, query);
  }

  // ═══════════════════════════════════════════
  // SELLER / ADMIN
  // ═══════════════════════════════════════════

  @Get('/')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'List returns for the authenticated seller' })
  @ApiResponse({ status: 200, description: 'Paginated list of returns' })
  async listForSeller(
    @ActiveStore('storeId') storeId: string,
    @Query() query: ReturnQueryDto,
  ) {
    return this.returnsService.listForSeller(storeId, query);
  }

  @Get('/:id')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Get one return (must belong to this seller)' })
  @ApiResponse({ status: 200, description: 'Return detail' })
  @ApiResponse({ status: 404, description: 'Return not found' })
  async getOne(
    @ActiveStore('storeId') storeId: string,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.returnsService.getForSeller(storeId, id);
  }

  @Patch('/:id/status')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({
    summary: 'Transition a return to a new status (state machine enforced)',
  })
  @ApiResponse({ status: 200, description: 'Updated return' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Return not found' })
  async updateStatus(
    @ActiveStore('storeId') storeId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateReturnStatusDto,
  ) {
    return this.returnsService.transition(id, storeId, dto.status, dto.notes);
  }

  @Patch('/:id/inspection')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({
    summary: 'Record the inspection outcome (only when status == inspected)',
  })
  @ApiResponse({ status: 200, description: 'Updated return with refund decision' })
  @ApiResponse({ status: 409, description: "Return is not in 'inspected' state" })
  @ApiResponse({ status: 404, description: 'Return not found' })
  async recordInspection(
    @ActiveStore('storeId') storeId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RecordInspectionDto,
  ) {
    return this.returnsService.recordInspection(id, storeId, dto);
  }
}
