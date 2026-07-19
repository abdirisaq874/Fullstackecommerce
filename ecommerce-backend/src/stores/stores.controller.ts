import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto, AddMemberDto, UpdateMemberRoleDto } from './dto/store.dto';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('mine')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Stores I own or am a member of' })
  listMine(@CurrentUser('_id') userId: string) {
    return this.stores.listMyStores(userId);
  }

  @Post()
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Create a new store (max 10 per owner)' })
  create(@CurrentUser('_id') userId: string, @Body() dto: CreateStoreDto) {
    return this.stores.createStore(userId, dto);
  }

  @Get(':id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Get a store I belong to' })
  get(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser('_id') userId: string) {
    return this.stores.getStore(id, userId);
  }

  @Patch(':id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Update store profile (manager+)' })
  update(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser('_id') userId: string, @Body() dto: UpdateStoreDto) {
    return this.stores.updateStore(id, userId, dto);
  }

  @Delete(':id')
  @Auth('admin', 'seller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a store (owner only)' })
  archive(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser('_id') userId: string) {
    return this.stores.archiveStore(id, userId);
  }

  // ── Members / staff ──
  @Get(':id/members')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'List store members' })
  listMembers(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser('_id') userId: string) {
    return this.stores.listMembers(id, userId);
  }

  @Post(':id/members')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Add an existing user as staff/manager (manager+)' })
  addMember(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser('_id') userId: string, @Body() dto: AddMemberDto) {
    return this.stores.addMember(id, userId, dto);
  }

  @Patch(':id/members/:userId')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Change a member’s role (manager+)' })
  updateMember(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('userId', ParseObjectIdPipe) targetUserId: string,
    @CurrentUser('_id') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.stores.updateMemberRole(id, userId, targetUserId, dto);
  }

  @Delete(':id/members/:userId')
  @Auth('admin', 'seller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member (manager+)' })
  removeMember(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('userId', ParseObjectIdPipe) targetUserId: string,
    @CurrentUser('_id') userId: string,
  ) {
    return this.stores.removeMember(id, userId, targetUserId);
  }
}
