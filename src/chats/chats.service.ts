import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not, IsNull } from 'typeorm';
import { Chatroom } from './entities/chatroom.entity';
import { ChatroomParticipant } from './entities/chatroom-participant.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { UserPresence } from './entities/user-presence.entity';
import { ChatDeliveryStatus, ChatroomType, UserType } from '../../types';
import { MessageFlag } from './entities/message-flag.entity';
import { buildPreview } from './preview.util';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chatroom)
    private readonly chatroomRepo: Repository<Chatroom>,
    @InjectRepository(ChatroomParticipant)
    private readonly participantRepo: Repository<ChatroomParticipant>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(UserPresence)
    private readonly presenceRepo: Repository<UserPresence>,
    @InjectRepository(MessageFlag)
    private readonly flagRepo: Repository<MessageFlag>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Chatroom ────────────────────────────────────────────────────────────────

  /**
   * Returns an existing chatroom between two users, or creates one.
   * Idempotent — calling twice with same pair returns the same room.
   * Type is derived from both users' roles — no caller-supplied type needed.
   * Rules: one SPONSOR + one STUDENT → SPONSOR_STUDENT; two STUDENTs → STUDENT_STUDENT.
   */
  async getOrCreateChatroom(
    userAId: string,
    userBId: string,
  ): Promise<{ chatroom: Chatroom; isNew: boolean }> {
    // Find an existing chatroom that contains BOTH users (type-agnostic)
    const existing = await this.dataSource
      .createQueryBuilder(Chatroom, 'c')
      .innerJoin('c.participants', 'pA', 'pA.userId = :userAId', { userAId })
      .innerJoin('c.participants', 'pB', 'pB.userId = :userBId', { userBId })
      .getOne();

    if (existing) return { chatroom: existing, isNew: false };

    // Derive chatroom type from both users' roles
    const users = await this.dataSource.query<{ id: string; role: string }[]>(
      `SELECT id, role FROM users WHERE id = ANY($1)`,
      [[userAId, userBId]],
    );
    const roles = new Set(users.map((u) => u.role));
    const type = roles.has(UserType.SPONSOR)
      ? ChatroomType.SPONSOR_STUDENT
      : ChatroomType.STUDENT_STUDENT;

    // Create new chatroom with both participants
    const chatroom = await this.dataSource.transaction(async (em) => {
      const room = em.create(Chatroom, { type });
      await em.save(room);

      await em.save(ChatroomParticipant, [
        em.create(ChatroomParticipant, {
          chatroomId: room.id,
          userId: userAId,
        }),
        em.create(ChatroomParticipant, {
          chatroomId: room.id,
          userId: userBId,
        }),
      ]);

      return room;
    });
    return { chatroom, isNew: true };
  }

  /**
   * Paginated chatroom list for a user, ordered by most recent message.
   * Returns rooms with last message preview + unread count per room.
   */
  async getChatrooms(
    userId: string,
    limit: number,
    cursor?: string,
    query?: string,
  ) {
    const params: unknown[] = [userId, limit + 1];
    let cursorClause = '';
    if (cursor) {
      params.push(cursor);
      cursorClause = `AND COALESCE(lm."lastAt", c."createdAt") < $${params.length}::timestamptz`;
    }
    let queryClause = '';
    if (query?.trim()) {
      params.push(`%${query.trim()}%`);
      const n = params.length;
      queryClause = `AND (partner_u."firstName" ILIKE $${n} OR partner_u."lastName" ILIKE $${n} OR CONCAT(partner_u."firstName", ' ', partner_u."lastName") ILIKE $${n})`;
    }

    // Raw SQL to avoid TypeORM query-wrapper losing the LEFT JOIN subquery alias
    const rawRooms: { id: string; type: string; createdAt: Date }[] =
      await this.dataSource.query(
        `
        SELECT c.id, c.type, c."createdAt"
        FROM chatrooms c
        INNER JOIN chatroom_participants me
          ON me."chatroomId" = c.id AND me."userId" = $1
        INNER JOIN chatroom_participants partner_p
          ON partner_p."chatroomId" = c.id AND partner_p."userId" != $1
        INNER JOIN users partner_u
          ON partner_u.id = partner_p."userId"
        LEFT JOIN (
          SELECT m."chatroomId", MAX(m."createdAt") AS "lastAt"
          FROM chat_messages m
          WHERE m."deletedAt" IS NULL
          GROUP BY m."chatroomId"
        ) lm ON lm."chatroomId" = c.id
        WHERE 1=1 ${cursorClause} ${queryClause}
        ORDER BY COALESCE(lm."lastAt", c."createdAt") DESC
        LIMIT $2
        `,
        params,
      );

    const hasMore = rawRooms.length > limit;
    const rooms = rawRooms.slice(0, limit);

    // For each room: fetch last message + partner info + unread count
    const enriched = await Promise.all(
      rooms.map(async (room) => {
        const [lastMessage, partner, unreadCount, myParticipant] =
          await Promise.all([
            this.getLastMessage(room.id),
            this.getChatroomPartner(room.id, userId),
            this.getUnreadCount(room.id, userId),
            this.participantRepo.findOne({
              where: { chatroomId: room.id, userId },
            }),
          ]);
        return {
          id: room.id,
          type: room.type,
          createdAt: room.createdAt,
          partner,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: buildPreview(lastMessage.content),
                createdAt: lastMessage.createdAt,
                deliveryStatus: lastMessage.deliveryStatus,
                senderId: lastMessage.senderId,
                sender: lastMessage.sender,
              }
            : null,
          unreadCount,
          lastReadAt: myParticipant?.lastReadAt ?? null,
        };
      }),
    );

    return { chatrooms: enriched, hasMore };
  }

  /** Fetch a single chatroom by ID in the same enriched shape as the list. */
  async getChatroomById(chatroomId: string, userId: string) {
    await this.assertParticipant(chatroomId, userId);
    const room = await this.chatroomRepo.findOne({ where: { id: chatroomId } });
    if (!room) throw new NotFoundException('Chatroom not found');

    const [lastMessage, partner, unreadCount, myParticipant] =
      await Promise.all([
        this.getLastMessage(room.id),
        this.getChatroomPartner(room.id, userId),
        this.getUnreadCount(room.id, userId),
        this.participantRepo.findOne({
          where: { chatroomId: room.id, userId },
        }),
      ]);

    return {
      id: room.id,
      type: room.type,
      createdAt: room.createdAt,
      partner,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: buildPreview(lastMessage.content),
            createdAt: lastMessage.createdAt,
            deliveryStatus: lastMessage.deliveryStatus,
            senderId: lastMessage.senderId,
            sender: lastMessage.sender,
          }
        : null,
      unreadCount,
      lastReadAt: myParticipant?.lastReadAt ?? null,
    };
  }

  private async getLastMessage(chatroomId: string) {
    return this.messageRepo.findOne({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { chatroomId, deletedAt: null as any },
      order: { createdAt: 'DESC' },
      relations: ['sender'],
      select: {
        id: true,
        content: true,
        createdAt: true,
        deliveryStatus: true,
        senderId: true,
        sender: { id: true, firstName: true, lastName: true },
      },
    });
  }

  private async getChatroomPartner(chatroomId: string, myUserId: string) {
    const all = await this.participantRepo.find({
      where: { chatroomId },
      relations: ['user'],
    });
    const other = all.find((p) => p.userId !== myUserId);
    if (!other?.user) return null;
    const { id, firstName, lastName, picture } = other.user;
    return { id, firstName, lastName, picture };
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  /** Cursor-based pagination (scrolling upward = older messages) */
  async getMessages(
    chatroomId: string,
    userId: string,
    before?: string,
    limit = 30,
  ) {
    await this.assertParticipant(chatroomId, userId);

    let qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.chatroomId = :chatroomId', { chatroomId })
      .andWhere('m.deletedAt IS NULL')
      .leftJoinAndSelect('m.sender', 'sender')
      .orderBy('m.createdAt', 'DESC')
      .limit(limit + 1);

    if (before) {
      const pivot = await this.messageRepo.findOne({ where: { id: before } });
      if (pivot) {
        qb = qb.andWhere('m.createdAt < :before', { before: pivot.createdAt });
      }
    }

    const msgs = await qb.getMany();
    const hasMore = msgs.length > limit;
    // Return in ascending order so the UI can render top-to-bottom
    return {
      messages: msgs.slice(0, limit).reverse(),
      hasMore,
    };
  }

  /** Save a new message and return it (called after WS broadcast) */
  async saveMessage(
    chatroomId: string,
    senderId: string,
    content: string,
  ): Promise<ChatMessage> {
    await this.assertParticipant(chatroomId, senderId);
    const msg = this.messageRepo.create({ chatroomId, senderId, content });
    return this.messageRepo.save(msg);
  }

  /**
   * Update lastReadAt for a participant in a room.
   * Idempotent: if the participant's lastReadAt is already >= the last partner
   * message's createdAt, the chat is fully read — skip the DB write and return
   * skipped: true. Gateway uses this to skip broadcasting (avoids phantom
   * "re-read" events from reconnect re-emits resetting the readAt timestamp).
   */
  async markRead(
    chatroomId: string,
    userId: string,
  ): Promise<{
    chatroomId: string;
    userId: string;
    readAt: Date;
    skipped: boolean;
    senderIds?: string[];
  }> {
    const participant = await this.assertParticipant(chatroomId, userId);

    // Find the most recent message NOT sent by the reader
    const lastPartnerMessage = await this.messageRepo.findOne({
      where: { chatroomId, senderId: Not(userId), deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      select: { id: true, createdAt: true },
    });

    // No messages from partner at all — nothing to mark
    if (!lastPartnerMessage) {
      const existingReadAt = participant.lastReadAt ?? new Date();
      return { chatroomId, userId, readAt: existingReadAt, skipped: true };
    }

    // Already read everything — skip write + broadcast
    if (
      participant.lastReadAt &&
      participant.lastReadAt >= lastPartnerMessage.createdAt
    ) {
      return {
        chatroomId,
        userId,
        readAt: participant.lastReadAt,
        skipped: true,
      };
    }

    const now = new Date();
    await this.participantRepo.update(
      { chatroomId, userId },
      { lastReadAt: now },
    );

    // Also update per-message delivery status so fetchMessages returns correct ticks
    await this.messageRepo
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ deliveryStatus: ChatDeliveryStatus.READ })
      .where('chatroomId = :chatroomId', { chatroomId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('deletedAt IS NULL')
      .andWhere('deliveryStatus != :status', {
        status: ChatDeliveryStatus.READ,
      })
      .execute();

    // Return sender IDs so the gateway can notify them via personal rooms
    const senderRows = await this.messageRepo
      .createQueryBuilder('m')
      .select('DISTINCT m.senderId', 'senderId')
      .where('m.chatroomId = :chatroomId', { chatroomId })
      .andWhere('m.senderId != :userId', { userId })
      .getRawMany<{ senderId: string }>();

    return {
      chatroomId,
      userId,
      readAt: now,
      skipped: false,
      senderIds: senderRows.map((r) => r.senderId),
    };
  }

  async getUnreadCount(chatroomId: string, userId: string): Promise<number> {
    const participant = await this.participantRepo.findOne({
      where: { chatroomId, userId },
    });
    const since = participant?.lastReadAt ?? new Date(0);

    return this.messageRepo
      .createQueryBuilder('m')
      .where('m.chatroomId = :chatroomId', { chatroomId })
      .andWhere('m.senderId != :userId', { userId })
      .andWhere('m.deletedAt IS NULL')
      .andWhere('m.createdAt > :since', { since })
      .getCount();
  }

  async getTotalUnread(userId: string): Promise<number> {
    const participants = await this.participantRepo.find({ where: { userId } });
    if (!participants.length) return 0;

    let total = 0;
    await Promise.all(
      participants.map(async (p) => {
        const count = await this.getUnreadCount(p.chatroomId, userId);
        total += count;
      }),
    );
    return total;
  }

  // ─── Flagging ────────────────────────────────────────────────────────────────

  async flagMessage(messageId: string, userId: string, reason?: string) {
    const msg = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.assertParticipant(msg.chatroomId, userId);
    if (msg.senderId === userId)
      throw new ForbiddenException('Cannot flag your own message');

    // Idempotent — don't create duplicate flag records
    const alreadyFlagged = await this.flagRepo.findOne({
      where: { messageId, reportedByUserId: userId },
    });
    if (alreadyFlagged) return { message: msg, flag: alreadyFlagged };

    // Mark the message
    msg.isFlagged = true;
    msg.flagReason = reason ?? null;
    const savedMsg = await this.messageRepo.save(msg);

    // Create admin-review record
    const flag = this.flagRepo.create({
      messageId,
      chatroomId: msg.chatroomId,
      reportedByUserId: userId,
      reason: reason ?? null,
    });
    const savedFlag = await this.flagRepo.save(flag);

    return { message: savedMsg, flag: savedFlag };
  }

  // ─── Presence ────────────────────────────────────────────────────────────────

  async setOnline(userId: string, isOnline: boolean) {
    let presence = await this.presenceRepo.findOne({ where: { userId } });
    if (!presence) {
      presence = this.presenceRepo.create({ userId });
    }
    presence.isOnline = isOnline;
    if (!isOnline) presence.lastSeenAt = new Date();
    return this.presenceRepo.save(presence);
  }

  async getPresence(userIds: string[]) {
    if (!userIds.length) return [];
    const rows = await this.presenceRepo.find({
      where: { userId: In(userIds) },
    });
    // Return a map with defaults for users we've never seen
    return userIds.map((uid) => {
      const row = rows.find((r) => r.userId === uid);
      return {
        userId: uid,
        isOnline: row?.isOnline ?? false,
        lastSeenAt: row?.lastSeenAt ?? null,
      };
    });
  }

  /** All recipient userIds in a chatroom excluding the sender */
  async getChatroomRecipients(
    chatroomId: string,
    senderId: string,
  ): Promise<string[]> {
    const participants = await this.participantRepo.find({
      where: { chatroomId },
    });
    return participants
      .filter((p) => p.userId !== senderId)
      .map((p) => p.userId);
  }

  /** All userIds of people who share a chatroom with this user (for WS broadcasts) */
  async getChatPartnerIds(userId: string): Promise<string[]> {
    const myRooms = await this.participantRepo.find({ where: { userId } });
    if (!myRooms.length) return [];

    const chatroomIds = myRooms.map((p) => p.chatroomId);
    const others = await this.participantRepo.find({
      where: { chatroomId: In(chatroomIds) },
    });
    return [
      ...new Set(
        others.filter((p) => p.userId !== userId).map((p) => p.userId),
      ),
    ];
  }

  // ─── Student search (sponsor compose modal) ──────────────────────────────────

  /**
   * Returns the 5 most recently sponsored students for the compose modal default list.
   * Falls back to a text search when `query` is provided.
   * ONLY returns students under this sponsor's jurisdiction.
   */
  async searchSponsorStudents(
    sponsorUserId: string,
    query?: string,
    limit = 10,
  ) {
    // Students are linked directly via StudentProfile.sponsorId → SponsorProfile.id
    let qb = this.dataSource
      .createQueryBuilder()
      .select([
        'u.id AS "userId"',
        'u."firstName" AS "firstName"',
        'u."lastName" AS "lastName"',
        'u.email AS email',
        'u.picture AS picture',
        'sp.id AS "studentProfileId"',
      ])
      .from('users', 'u')
      .innerJoin('student_profiles', 'sp', 'sp."userId" = u.id')
      .innerJoin('sponsor_profiles', 'spr', 'spr.id = sp."sponsorId"::uuid')
      .where('spr."userId" = :sponsorUserId', { sponsorUserId })
      .andWhere('sp."isSponsored" = true')
      .orderBy('sp."createdAt"', 'DESC')
      .limit(limit);

    if (query) {
      qb = qb.andWhere(
        '(u."firstName" ILIKE :q OR u."lastName" ILIKE :q OR u.email ILIKE :q)',
        { q: `%${query}%` },
      );
    }

    return qb.getRawMany();
  }

  // ─── Student user search ─────────────────────────────────────────────────────

  /**
   * Search for a user by exact or prefix email match — for the student compose modal.
   * Excludes the searching user. Returns at most 5 results.
   * Students can only start chats with other users they know the email of.
   */
  async searchUsersByEmail(email: string, excludeUserId: string) {
    return this.dataSource
      .createQueryBuilder()
      .select([
        'u.id AS "userId"',
        'u."firstName" AS "firstName"',
        'u."lastName" AS "lastName"',
        'u.email AS email',
        'u.picture AS picture',
        'u.role AS role',
      ])
      .from('users', 'u')
      .where('u.email ILIKE :email', { email })
      .andWhere('u.id != :excludeUserId', { excludeUserId })
      .andWhere('u."isActive" = true')
      .limit(5)
      .getRawMany();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  async assertParticipant(chatroomId: string, userId: string) {
    const exists = await this.participantRepo.findOne({
      where: { chatroomId, userId },
    });
    if (!exists)
      throw new ForbiddenException(
        'You are not a participant in this chatroom',
      );
    return exists;
  }
}
