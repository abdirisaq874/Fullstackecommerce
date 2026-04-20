import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Notification } from './schemas/notification.schema';
import { PaginatedResponseDto, PaginationDto } from '../shared/database/pagination.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Notification.name) private notifModel: Model<Notification>,
    private config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('mail.host'),
      port: config.get<number>('mail.port'),
      auth: {
        user: config.get<string>('mail.user'),
        pass: config.get<string>('mail.password'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.config.get('mail.fromName')}" <${this.config.get('mail.from')}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }

  async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<Notification> {
    return this.notifModel.create({
      userId: new Types.ObjectId(userId),
      type,
      channel: 'in_app',
      title,
      body,
      referenceType,
      referenceId: referenceId ? new Types.ObjectId(referenceId) : undefined,
      sentAt: new Date(),
    });
  }

  async getUserNotifications(userId: string, pagination: PaginationDto) {
    const filter = { userId: new Types.ObjectId(userId) };
    const [notifications, total] = await Promise.all([
      this.notifModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      this.notifModel.countDocuments(filter),
    ]);
    return new PaginatedResponseDto(notifications, total, pagination.page, pagination.limit);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notifModel.updateOne(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { $set: { isRead: true, readAt: new Date() } },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }
}
