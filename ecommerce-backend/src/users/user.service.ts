import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto, CreateAddressDto, UpdateAddressDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findById(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: dto },
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── Addresses ───
  async getAddresses(userId: string) {
    const user = await this.findById(userId);
    return user.addresses;
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    const user = await this.findById(userId);

    // If setting as default, unset other defaults of same type
    if (dto.isDefault) {
      user.addresses.forEach((addr) => {
        if (addr.type === (dto.type || 'shipping')) {
          addr.isDefault = false;
        }
      });
    }

    user.addresses.push(dto as any);
    await user.save();
    return user.addresses[user.addresses.length - 1];
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const user = await this.findById(userId);
    const address = user.addresses.id(addressId);
    if (!address) throw new NotFoundException('Address not found');

    if (dto.isDefault) {
      user.addresses.forEach((addr) => {
        if (addr.type === address.type) addr.isDefault = false;
      });
    }

    Object.assign(address, dto);
    await user.save();
    return address;
  }

  async removeAddress(userId: string, addressId: string) {
    const user = await this.findById(userId);
    const address = user.addresses.id(addressId);
    if (!address) throw new NotFoundException('Address not found');

    user.addresses.pull({ _id: new Types.ObjectId(addressId) });
    await user.save();
    return { message: 'Address removed' };
  }
}
