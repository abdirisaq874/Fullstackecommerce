import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store, StoreDocument, StoreStatus } from './schemas/store.schema';
import {
  StoreMembership, StoreMembershipDocument, StoreRole, MembershipStatus,
} from './schemas/store-membership.schema';
import { User } from '../users/schemas/user.schema';
import { CreateStoreDto, UpdateStoreDto, AddMemberDto, UpdateMemberRoleDto } from './dto/store.dto';

const MAX_STORES_PER_OWNER = 10;
const ROLE_RANK: Record<StoreRole, number> = {
  [StoreRole.OWNER]: 3,
  [StoreRole.MANAGER]: 2,
  [StoreRole.STAFF]: 1,
};

export interface ActiveStoreContext {
  storeId: string;
  role: StoreRole;
}

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private storeModel: Model<Store>,
    @InjectModel(StoreMembership.name) private membershipModel: Model<StoreMembership>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  private slugify(s: string): string {
    return (
      s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) ||
      'store'
    );
  }

  /** Generate a globally-unique slug from a desired string. */
  private async uniqueSlug(desired: string, excludeStoreId?: string): Promise<string> {
    const base = this.slugify(desired);
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await this.slugTaken(slug, excludeStoreId)) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }
  private async slugTaken(slug: string, excludeStoreId?: string): Promise<boolean> {
    const doc = await this.storeModel.findOne({ slug }).select('_id').lean();
    return !!doc && (!excludeStoreId || doc._id.toString() !== excludeStoreId);
  }

  // ── Membership / authorization ──────────────────────────────────────────

  /** The user's ACTIVE membership for a store, or null. */
  async getMembership(storeId: string, userId: string): Promise<StoreMembershipDocument | null> {
    if (!Types.ObjectId.isValid(storeId)) return null;
    return this.membershipModel.findOne({
      storeId: new Types.ObjectId(storeId),
      userId: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE,
    });
  }

  /**
   * Assert the user is an active member with at least `min` role; returns the
   * role. By default also rejects archived stores (no mutations / active context
   * on an archived store); pass allowArchived=true for read-only views.
   */
  async assertMember(
    storeId: string,
    userId: string,
    min: StoreRole = StoreRole.STAFF,
    allowArchived = false,
  ): Promise<StoreRole> {
    const m = await this.getMembership(storeId, userId);
    if (!m) throw new ForbiddenException('You are not a member of this store');
    if (ROLE_RANK[m.role] < ROLE_RANK[min]) {
      throw new ForbiddenException(`Requires ${min} role or higher for this store`);
    }
    if (!allowArchived) {
      const store = await this.storeModel.findById(storeId).select('status').lean();
      if (!store) throw new NotFoundException('Store not found');
      if (store.status !== StoreStatus.ACTIVE) throw new ForbiddenException('This store is archived');
    }
    return m.role;
  }

  /**
   * Resolve the active store for a request: an explicit id (from the X-Store-Id
   * header) must be one the user is a member of; with no id we fall back to the
   * user's default store (the one whose _id === userId, else their first store).
   */
  async resolveActiveStore(userId: string, requestedStoreId?: string): Promise<ActiveStoreContext> {
    if (requestedStoreId) {
      const role = await this.assertMember(requestedStoreId, userId);
      return { storeId: requestedStoreId, role };
    }
    const def = await this.getDefaultStoreId(userId);
    if (!def) throw new ForbiddenException('You do not have a store yet');
    const role = await this.assertMember(def, userId);
    return { storeId: def, role };
  }

  /** The default store id for a user: prefer the store whose _id === userId. */
  async getDefaultStoreId(userId: string): Promise<string | null> {
    const uid = new Types.ObjectId(userId);
    const selfStore = await this.storeModel.findOne({ _id: uid, status: StoreStatus.ACTIVE }).select('_id').lean();
    if (selfStore) return selfStore._id.toString();
    // Fallback: oldest membership whose store is still ACTIVE (never an archived store).
    const memberships = await this.membershipModel
      .find({ userId: uid, status: MembershipStatus.ACTIVE })
      .sort({ createdAt: 1 })
      .select('storeId')
      .lean();
    if (!memberships.length) return null;
    const ids = memberships.map((m) => m.storeId);
    const active = await this.storeModel.find({ _id: { $in: ids }, status: StoreStatus.ACTIVE }).select('_id').lean();
    const activeSet = new Set(active.map((s) => s._id.toString()));
    for (const m of memberships) {
      const sid = m.storeId.toString();
      if (activeSet.has(sid)) return sid;
    }
    return null;
  }

  // ── Store CRUD ──────────────────────────────────────────────────────────

  /** Stores the user is an active member of, annotated with their role. */
  async listMyStores(userId: string): Promise<any[]> {
    const uid = new Types.ObjectId(userId);
    const memberships = await this.membershipModel
      .find({ userId: uid, status: MembershipStatus.ACTIVE })
      .lean();
    if (!memberships.length) return [];
    const byStore = new Map(memberships.map((m) => [m.storeId.toString(), m.role]));
    const stores = await this.storeModel
      .find({ _id: { $in: memberships.map((m) => m.storeId) } })
      .sort({ createdAt: 1 })
      .lean();
    return stores.map((s) => ({ ...s, myRole: byStore.get(s._id.toString()) }));
  }

  async createStore(userId: string, dto: CreateStoreDto): Promise<StoreDocument> {
    const uid = new Types.ObjectId(userId);
    const owned = await this.storeModel.countDocuments({ ownerId: uid, status: StoreStatus.ACTIVE });
    if (owned >= MAX_STORES_PER_OWNER) {
      throw new BadRequestException(`You can own at most ${MAX_STORES_PER_OWNER} stores`);
    }
    const slug = await this.uniqueSlug(dto.slug || dto.displayName);
    let store;
    try {
      store = await this.storeModel.create({
        ownerId: uid,
        displayName: dto.displayName,
        slug,
        logoUrl: dto.logoUrl,
        country: dto.country,
        currency: dto.currency || 'USD',
        status: StoreStatus.ACTIVE,
      });
    } catch (e: any) {
      // Race: another create grabbed the slug between our check and insert.
      if (e?.code === 11000) throw new ConflictException('That store slug was just taken — try another');
      throw e;
    }
    await this.membershipModel.create({
      storeId: store._id,
      userId: uid,
      role: StoreRole.OWNER,
      status: MembershipStatus.ACTIVE,
      acceptedAt: new Date(),
    });
    return store;
  }

  async getStore(storeId: string, userId: string): Promise<StoreDocument> {
    await this.assertMember(storeId, userId, StoreRole.STAFF, true); // viewing an archived store is allowed
    const store = await this.storeModel.findById(storeId);
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateStore(storeId: string, userId: string, dto: UpdateStoreDto): Promise<StoreDocument> {
    await this.assertMember(storeId, userId, StoreRole.MANAGER);
    const store = await this.storeModel.findById(storeId);
    if (!store) throw new NotFoundException('Store not found');
    if (dto.slug && dto.slug !== store.slug) {
      if (await this.slugTaken(dto.slug, storeId)) throw new ConflictException('Slug is already taken');
      store.slug = dto.slug;
    }
    for (const k of ['displayName', 'logoUrl', 'country', 'currency', 'supportEmail', 'supportPhone'] as const) {
      if (dto[k] !== undefined) (store as any)[k] = dto[k];
    }
    await store.save();
    return store;
  }

  /** Archive (soft-delete) a store — owner only. Idempotent. */
  async archiveStore(storeId: string, userId: string): Promise<{ archived: true }> {
    await this.assertMember(storeId, userId, StoreRole.OWNER, true);
    await this.storeModel.updateOne({ _id: new Types.ObjectId(storeId) }, { $set: { status: StoreStatus.ARCHIVED } });
    return { archived: true };
  }

  // ── Staff / membership management ─────────────────────────────────────────

  async listMembers(storeId: string, userId: string): Promise<any[]> {
    await this.assertMember(storeId, userId, StoreRole.STAFF, true);
    const members = await this.membershipModel
      .find({ storeId: new Types.ObjectId(storeId), status: { $ne: MembershipStatus.REVOKED } })
      .lean();
    const users = await this.userModel
      .find({ _id: { $in: members.map((m) => m.userId) } })
      .select('email firstName lastName')
      .lean();
    const byId = new Map(users.map((u: any) => [u._id.toString(), u]));
    return members.map((m) => {
      const u: any = byId.get(m.userId.toString());
      return {
        userId: m.userId.toString(),
        role: m.role,
        status: m.status,
        email: u?.email,
        name: u ? `${u.firstName} ${u.lastName}` : undefined,
      };
    });
  }

  /**
   * Add an existing user as staff/manager. (Email-invite acceptance flow arrives
   * with the email system; for now the target must already have an account.)
   */
  async addMember(storeId: string, actingUserId: string, dto: AddMemberDto): Promise<{ userId: string; role: StoreRole }> {
    const actingRole = await this.assertMember(storeId, actingUserId, StoreRole.MANAGER);
    // You may only grant a role STRICTLY BELOW your own (so a manager can add
    // staff but not another manager; only an owner can add a manager).
    if (ROLE_RANK[actingRole] <= ROLE_RANK[dto.role]) {
      throw new ForbiddenException(`You cannot grant the ${dto.role} role`);
    }
    const target = await this.userModel.findOne({ email: dto.email.toLowerCase() }).select('_id').lean();
    if (!target) throw new BadRequestException('No user with that email — they must create an account first');
    const targetId = target._id.toString();
    const existing = await this.membershipModel.findOne({
      storeId: new Types.ObjectId(storeId),
      userId: target._id,
    });
    if (existing && existing.status === MembershipStatus.ACTIVE) {
      throw new ConflictException('That user is already a member of this store');
    }
    // Cannot touch a member whose current role equals or outranks yours.
    if (existing && ROLE_RANK[existing.role] >= ROLE_RANK[actingRole]) {
      throw new ForbiddenException('You cannot modify a member of equal or higher rank');
    }
    await this.membershipModel.updateOne(
      { storeId: new Types.ObjectId(storeId), userId: target._id },
      {
        $set: { role: dto.role, status: MembershipStatus.ACTIVE, invitedBy: new Types.ObjectId(actingUserId), acceptedAt: new Date() },
      },
      { upsert: true },
    );
    return { userId: targetId, role: dto.role };
  }

  async updateMemberRole(storeId: string, actingUserId: string, targetUserId: string, dto: UpdateMemberRoleDto): Promise<void> {
    const actingRole = await this.assertMember(storeId, actingUserId, StoreRole.MANAGER);
    const m = await this.membershipModel.findOne({ storeId: new Types.ObjectId(storeId), userId: new Types.ObjectId(targetUserId) });
    if (!m) throw new NotFoundException('Member not found');
    // Must strictly outrank BOTH the target's current role and the role you're granting.
    if (ROLE_RANK[actingRole] <= ROLE_RANK[m.role]) {
      throw new ForbiddenException('You cannot modify a member of equal or higher rank');
    }
    if (ROLE_RANK[actingRole] <= ROLE_RANK[dto.role]) {
      throw new ForbiddenException(`You cannot grant the ${dto.role} role`);
    }
    m.role = dto.role;
    await m.save();
  }

  async removeMember(storeId: string, actingUserId: string, targetUserId: string): Promise<void> {
    const actingRole = await this.assertMember(storeId, actingUserId, StoreRole.MANAGER);
    if (targetUserId === actingUserId) throw new BadRequestException('You cannot remove yourself');
    const m = await this.membershipModel.findOne({ storeId: new Types.ObjectId(storeId), userId: new Types.ObjectId(targetUserId) });
    if (!m) throw new NotFoundException('Member not found');
    // Can only remove a member you strictly outrank (blocks removing owner/peers).
    if (ROLE_RANK[actingRole] <= ROLE_RANK[m.role]) {
      throw new ForbiddenException('You cannot remove a member of equal or higher rank');
    }
    await this.membershipModel.deleteOne({ _id: m._id });
  }
}
