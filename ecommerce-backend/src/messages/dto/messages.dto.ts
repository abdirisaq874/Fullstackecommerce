import {
  IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsNumber,
  IsNotEmpty, IsMongoId, MaxLength, MinLength, Min, ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../shared/database/pagination.dto';
import { THREAD_STATUS } from '../schemas/message-thread.schema';

export class MessageAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeBytes?: number;
}

export class CreateThreadDto {
  @ApiProperty({ description: 'Recipient user id (the other participant)' })
  @IsMongoId()
  recipientUserId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  relatedOrderId?: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

export class ReplyMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

export class ThreadQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: THREAD_STATUS })
  @IsOptional()
  @IsEnum(THREAD_STATUS)
  status?: typeof THREAD_STATUS[number];

  @ApiPropertyOptional({ description: 'Search subject / last preview' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Only return threads with unread messages for me' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly?: boolean;
}

export class ThreadMessagesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  messagePage: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  messageLimit: number = 50;
}
