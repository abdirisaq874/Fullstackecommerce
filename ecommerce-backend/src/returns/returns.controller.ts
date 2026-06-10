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
  Roles,
  RolesGuard,
} from '../auth/guards/auth.guards';
import { UserRole } from '../users/schemas/user.schema';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List returns for the authenticated seller' })
  @ApiResponse({ status: 200, description: 'Paginated list of returns' })
  async listForSeller(
    @CurrentUser('_id') sellerId: string,
    @Query() query: ReturnQueryDto,
  ) {
    return this.returnsService.listForSeller(sellerId, query);
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get one return (must belong to this seller)' })
  @ApiResponse({ status: 200, description: 'Return detail' })
  @ApiResponse({ status: 404, description: 'Return not found' })
  async getOne(
    @CurrentUser('_id') sellerId: string,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.returnsService.getForSeller(sellerId, id);
  }

  @Patch('/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Transition a return to a new status (state machine enforced)',
  })
  @ApiResponse({ status: 200, description: 'Updated return' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Return not found' })
  async updateStatus(
    @CurrentUser('_id') sellerId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateReturnStatusDto,
  ) {
    return this.returnsService.transition(id, sellerId, dto.status, dto.notes);
  }

  @Patch('/:id/inspection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Record the inspection outcome (only when status == inspected)',
  })
  @ApiResponse({ status: 200, description: 'Updated return with refund decision' })
  @ApiResponse({ status: 409, description: "Return is not in 'inspected' state" })
  @ApiResponse({ status: 404, description: 'Return not found' })
  async recordInspection(
    @CurrentUser('_id') sellerId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RecordInspectionDto,
  ) {
    return this.returnsService.recordInspection(id, sellerId, dto);
  }
}
