import {
  Controller, Get, Patch, Post, Delete, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { UpdateProfileDto, CreateAddressDto, UpdateAddressDto } from './dto/user.dto';
import { UserDocument } from './schemas/user.schema';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: UserDocument) {
    return user;
  }

  @Patch('me')
  @Auth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @CurrentUser('_id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  // ─── Addresses ───
  @Get('me/addresses')
  @Auth()
  @ApiOperation({ summary: 'Get user addresses' })
  async getAddresses(@CurrentUser('_id') userId: string) {
    return this.userService.getAddresses(userId);
  }

  @Post('me/addresses')
  @Auth()
  @ApiOperation({ summary: 'Add a new address' })
  async addAddress(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.userService.addAddress(userId, dto);
  }

  @Patch('me/addresses/:addressId')
  @Auth()
  @ApiOperation({ summary: 'Update an address' })
  async updateAddress(
    @CurrentUser('_id') userId: string,
    @Param('addressId', ParseObjectIdPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.userService.updateAddress(userId, addressId, dto);
  }

  @Delete('me/addresses/:addressId')
  @Auth()
  @ApiOperation({ summary: 'Remove an address' })
  async removeAddress(
    @CurrentUser('_id') userId: string,
    @Param('addressId', ParseObjectIdPipe) addressId: string,
  ) {
    return this.userService.removeAddress(userId, addressId);
  }
}
