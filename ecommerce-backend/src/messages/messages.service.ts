import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  MessageThread,
  MessageThreadDocument,
} from './schemas/message-thread.schema';
import { Message, MessageDocument, MessageAuthorRole } from './schemas/message.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { PaginatedResponseDto } from '../shared/database/pagination.dto';
import {
  CreateThreadDto,
  ReplyMessageDto,
  ThreadQueryDto,
  MessageAttachmentDto,
} from './dto/messages.dto';

const PREVIEW_MAX = 120;

interface ThreadParticipants {
  sellerId: Types.ObjectId;
  customerId: Types.ObjectId;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(MessageThread.name) private threadModel: Model<MessageThread>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  // ═══════════════════════════════════════════
  // LIST THREADS
  // ═══════════════════════════════════════════

  async listThreads(
    userId: string,
    query: ThreadQueryDto,
  ): Promise<PaginatedResponseDto<MessageThreadDocument>> {
    const me = new Types.ObjectId(userId);

    const filter: FilterQuery<MessageThread> = {
      $or: [{ sellerId: me }, { customerId: me }],
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: safe, $options: 'i' };
      // Combine participant scope with search — keep the participant $or in an
      // $and so we don't accidentally widen the result set.
      filter.$and = [
        { $or: [{ sellerId: me }, { customerId: me }] },
        { $or: [{ subject: rx }, { lastMessagePreview: rx }] },
      ];
      delete filter.$or;
    }

    if (query.unreadOnly) {
      const unreadOr = [
        { sellerId: me, unreadCountSeller: { $gt: 0 } },
        { customerId: me, unreadCountCustomer: { $gt: 0 } },
      ];
      if (filter.$and) {
        filter.$and.push({ $or: unreadOr });
      } else {
        filter.$and = [
          { $or: [{ sellerId: me }, { customerId: me }] },
          { $or: unreadOr },
        ];
        delete filter.$or;
      }
    }

    const [data, total] = await Promise.all([
      this.threadModel
        .find(filter)
        .populate('sellerId', 'firstName lastName email avatarUrl')
        .populate('customerId', 'firstName lastName email avatarUrl')
        .populate('relatedOrderId', 'orderNumber status')
        .sort({ lastMessageAt: -1 })
        .skip(query.skip)
        .limit(query.limit),
      this.threadModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  // ═══════════════════════════════════════════
  // THREAD DETAIL + MESSAGES
  // ═══════════════════════════════════════════

  async getThread(
    userId: string,
    threadId: string,
    messagePage: number = 1,
    messageLimit: number = 50,
  ): Promise<{
    thread: MessageThreadDocument;
    messages: PaginatedResponseDto<MessageDocument>;
  }> {
    const thread = await this.loadThreadAsParticipant(userId, threadId, {
      populate: true,
    });

    const skip = (messagePage - 1) * messageLimit;
    const filter: FilterQuery<Message> = { threadId: thread._id };

    const [data, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .populate('authorId', 'firstName lastName email avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(messageLimit),
      this.messageModel.countDocuments(filter),
    ]);

    return {
      thread,
      messages: new PaginatedResponseDto(data, total, messagePage, messageLimit),
    };
  }

  // ═══════════════════════════════════════════
  // CREATE THREAD (+ first message)
  // ═══════════════════════════════════════════

  async createThread(
    userId: string,
    dto: CreateThreadDto,
  ): Promise<{ thread: MessageThreadDocument; message: MessageDocument }> {
    if (userId === dto.recipientUserId) {
      throw new BadRequestException('Cannot create a thread with yourself');
    }

    const [me, recipient] = await Promise.all([
      this.userModel.findById(userId).select('role'),
      this.userModel.findById(dto.recipientUserId).select('role'),
    ]);

    if (!me) throw new NotFoundException('Current user not found');
    if (!recipient) throw new NotFoundException('Recipient user not found');

    const { sellerId, customerId, authorRole } = this.resolveParticipants(
      { id: userId, role: me.role as unknown as UserRole },
      { id: dto.recipientUserId, role: recipient.role as unknown as UserRole },
    );

    const now = new Date();
    const preview = this.buildPreview(dto.body);

    // Authoring user is the one with non-zero unread count on the OTHER side.
    const initialUnreadSeller = authorRole === 'customer' ? 1 : 0;
    const initialUnreadCustomer = authorRole === 'seller' ? 1 : 0;

    const thread = await this.threadModel.create({
      sellerId,
      customerId,
      subject: dto.subject,
      lastMessageAt: now,
      lastMessagePreview: preview,
      unreadCountSeller: initialUnreadSeller,
      unreadCountCustomer: initialUnreadCustomer,
      relatedOrderId: dto.relatedOrderId
        ? new Types.ObjectId(dto.relatedOrderId)
        : undefined,
      status: 'open',
    });

    const message = await this.messageModel.create({
      threadId: thread._id,
      authorId: new Types.ObjectId(userId),
      authorRole,
      body: dto.body,
      attachments: this.normalizeAttachments(dto.attachments),
      // Author has effectively "read" their own message immediately.
      readBySellerAt: authorRole === 'seller' ? now : undefined,
      readByCustomerAt: authorRole === 'customer' ? now : undefined,
    });

    return { thread, message };
  }

  // ═══════════════════════════════════════════
  // REPLY
  // ═══════════════════════════════════════════

  async reply(
    userId: string,
    threadId: string,
    dto: ReplyMessageDto,
  ): Promise<MessageDocument> {
    const thread = await this.loadThreadAsParticipant(userId, threadId);

    if (thread.status === 'closed') {
      throw new BadRequestException('Thread is closed');
    }

    const me = new Types.ObjectId(userId);
    const authorIsSeller = thread.sellerId.equals(me);
    const authorRole: MessageAuthorRole = authorIsSeller ? 'seller' : 'customer';

    const now = new Date();
    const preview = this.buildPreview(dto.body);

    const message = await this.messageModel.create({
      threadId: thread._id,
      authorId: me,
      authorRole,
      body: dto.body,
      attachments: this.normalizeAttachments(dto.attachments),
      readBySellerAt: authorIsSeller ? now : undefined,
      readByCustomerAt: authorIsSeller ? undefined : now,
    });

    // Increment unread on the OTHER side; never on the author's side.
    const update: Record<string, any> = {
      $set: {
        lastMessageAt: now,
        lastMessagePreview: preview,
      },
      $inc: authorIsSeller
        ? { unreadCountCustomer: 1 }
        : { unreadCountSeller: 1 },
    };

    await this.threadModel.updateOne({ _id: thread._id }, update);

    return message;
  }

  // ═══════════════════════════════════════════
  // MARK READ
  // ═══════════════════════════════════════════

  async markRead(
    userId: string,
    threadId: string,
  ): Promise<{ threadId: string; markedAt: Date; modified: number }> {
    const thread = await this.loadThreadAsParticipant(userId, threadId);
    const me = new Types.ObjectId(userId);
    const isSeller = thread.sellerId.equals(me);
    const now = new Date();

    const readField = isSeller ? 'readBySellerAt' : 'readByCustomerAt';
    const unreadField = isSeller ? 'unreadCountSeller' : 'unreadCountCustomer';

    // Mark every still-unread message as read for this user. We only touch
    // documents missing the read timestamp so the "first read at" semantics
    // are preserved across repeated calls.
    const res = await this.messageModel.updateMany(
      { threadId: thread._id, [readField]: { $exists: false } },
      { $set: { [readField]: now } },
    );

    await this.threadModel.updateOne(
      { _id: thread._id },
      { $set: { [unreadField]: 0 } },
    );

    return {
      threadId: thread._id.toString(),
      markedAt: now,
      modified: res.modifiedCount ?? 0,
    };
  }

  // ═══════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════

  /**
   * Load a thread and assert that the requesting user is one of the two
   * participants. Throws 404 if missing, 403 if not a participant — the same
   * shape every controller endpoint relies on.
   */
  private async loadThreadAsParticipant(
    userId: string,
    threadId: string,
    opts: { populate?: boolean } = {},
  ): Promise<MessageThreadDocument> {
    if (!Types.ObjectId.isValid(threadId)) {
      throw new NotFoundException('Thread not found');
    }
    const query = this.threadModel.findById(threadId);
    if (opts.populate) {
      query
        .populate('sellerId', 'firstName lastName email avatarUrl')
        .populate('customerId', 'firstName lastName email avatarUrl')
        .populate('relatedOrderId', 'orderNumber status');
    }
    const thread = await query.exec();
    if (!thread) throw new NotFoundException('Thread not found');

    const me = new Types.ObjectId(userId);
    // sellerId / customerId may have been populated to a User doc; compare
    // against either the raw ObjectId or the populated _id.
    const sellerId = this.toObjectId(thread.sellerId);
    const customerId = this.toObjectId(thread.customerId);

    if (!sellerId.equals(me) && !customerId.equals(me)) {
      throw new ForbiddenException('Not a participant of this thread');
    }
    return thread;
  }

  /**
   * Pick which user is the seller and which is the customer for a new thread.
   * Rules:
   *   - If exactly one of {me, recipient} has role 'seller' → that's the seller.
   *   - If neither has role 'seller' → reject (must include a seller).
   *   - If both have role 'seller' → reject (ambiguous; not a valid thread).
   * Admin role is allowed to message either side and is treated as the
   * customer-side participant for storage purposes; authorRole on the first
   * message is still 'admin'.
   */
  private resolveParticipants(
    me: { id: string; role: UserRole },
    other: { id: string; role: UserRole },
  ): ThreadParticipants & { authorRole: MessageAuthorRole } {
    const meIsSeller = me.role === UserRole.SELLER;
    const otherIsSeller = other.role === UserRole.SELLER;

    if (meIsSeller && otherIsSeller) {
      throw new BadRequestException('Both participants are sellers');
    }
    if (!meIsSeller && !otherIsSeller) {
      throw new BadRequestException(
        'One participant must be a seller',
      );
    }

    const sellerId = new Types.ObjectId(meIsSeller ? me.id : other.id);
    const customerId = new Types.ObjectId(meIsSeller ? other.id : me.id);

    let authorRole: MessageAuthorRole;
    if (me.role === UserRole.ADMIN) authorRole = 'admin';
    else if (meIsSeller) authorRole = 'seller';
    else authorRole = 'customer';

    return { sellerId, customerId, authorRole };
  }

  /** Trim message body down to the preview cap (no trailing whitespace). */
  private buildPreview(body: string): string {
    const flat = body.replace(/\s+/g, ' ').trim();
    if (flat.length <= PREVIEW_MAX) return flat;
    return flat.slice(0, PREVIEW_MAX - 1).trimEnd() + '…';
  }

  private normalizeAttachments(
    attachments?: MessageAttachmentDto[],
  ): MessageAttachmentDto[] {
    if (!attachments || attachments.length === 0) return [];
    return attachments.map((a) => ({
      url: a.url,
      name: a.name,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    }));
  }

  /** Accept either an ObjectId or a populated doc and return the id. */
  private toObjectId(value: any): Types.ObjectId {
    if (value instanceof Types.ObjectId) return value;
    if (value && value._id) return value._id as Types.ObjectId;
    return new Types.ObjectId(String(value));
  }
}
