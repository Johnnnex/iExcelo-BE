import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ONE_HOUR_MS } from '../common/constants';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './entities/notification.entity';
import { PushService } from './push/push.service';
import { User } from '../users/entities/user.entity';
import { UserType } from '../../types';
import {
  NOTIFICATIONS_QUEUE,
  NotificationJobs,
  EmailBatchJobData,
  EmailBatchMessage,
  MsgNotificationBatchJobData,
  MsgBatchEntry,
} from './queue/notifications.queue';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface NotifyNewMessageDto {
  chatroomId: string;
  senderId: string;
  recipientId: string;
  preview: string;
  isRecipientInChatroom: boolean;
  /** lastSeenAt from presence table — used to decide email threshold */
  recipientLastSeenAt: Date | null;
}

export interface NotifyNewChatroomDto {
  recipientId: string;
  sponsorName: string;
  chatroomId: string;
  /** lastSeenAt from presence table */
  recipientLastSeenAt: Date | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /** 30 seconds — each new message resets this window */
  private readonly MSG_DEBOUNCE_MS = 30 * 1000;

  /** 5 minutes — hard cap; job fires even if messages keep coming */
  private readonly MSG_HARD_CAP_MS = 5 * 60 * 1000;

  /** 10 minutes — delay before email batch fires for fully offline users */
  private readonly EMAIL_DELAY_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notifQueue: Queue,
    private readonly pushService: PushService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Triggered by ChatsGateway after a message is saved.
   *
   * Scenario 1 — recipient IS in the chatroom: cancel any pending notification
   * job for this chatroom (they've already seen it) and return null.
   *
   * Scenario 2 — recipient is NOT in the chatroom: queue/debounce via BullMQ.
   * - 30 s debounce (reset on each new message in the same chatroom)
   * - 5 min hard cap (fires regardless if sender keeps going)
   * - If messages_read fires before the job executes → cancelChatroomNotification
   *   removes the job entirely; no DB record, no push, nothing.
   *
   * Returns null always — the DB record is created when the job fires (processor).
   */
  async notifyNewMessage(dto: NotifyNewMessageDto): Promise<null> {
    try {
      // Scenario 1: recipient is actively in the chatroom — they saw it
      if (dto.isRecipientInChatroom) {
        await this.cancelChatroomNotification(dto.recipientId, dto.chatroomId);
        return null;
      }

      const recipient = await this.userRepo.findOne({
        where: { id: dto.recipientId },
        select: ['id', 'email', 'firstName', 'role'],
      });
      if (!recipient) return null;

      const sender = await this.userRepo.findOne({
        where: { id: dto.senderId },
        select: ['id', 'firstName', 'lastName'],
      });
      const senderName = sender
        ? `${sender.firstName} ${sender.lastName}`
        : 'Someone';

      // Scenario 3: queue/debounce
      await this.scheduleMsgNotificationBatch(recipient, {
        chatroomId: dto.chatroomId,
        senderId: dto.senderId,
        senderName,
        preview: dto.preview,
        recipientLastSeenAt: dto.recipientLastSeenAt,
      });

      return null;
    } catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`notifyNewMessage failed: ${err?.message}`);
      return null;
    }
  }

  /**
   * Cancel a pending msg-notif job for a chatroom.
   * Called when:
   * - recipient is already in the chatroom when a message arrives (scenario 1)
   * - recipient emits messages_read (scenario 2)
   */
  async cancelChatroomNotification(
    recipientId: string,
    chatroomId: string,
  ): Promise<void> {
    const jobId = `msg-notif:${recipientId}:${chatroomId}`;
    try {
      const job = await this.notifQueue.getJob(jobId);
      if (job) await job.remove();
    } catch (err: any) {
      this.logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `cancelChatroomNotification failed for ${jobId}: ${err?.message}`,
      );
    }
  }

  /**
   * Called by NotificationsProcessor when the debounce job fires.
   * Creates the DB notification record, sends push, and queues email if needed.
   * Returns the Notification so the processor can emit notification_created via WS.
   */
  async deliverMsgNotificationBatch(
    data: MsgNotificationBatchJobData,
  ): Promise<Notification | null> {
    try {
      const count = data.messages.length;
      const lastPreview = data.messages[count - 1].preview;
      const title =
        count === 1
          ? `New message from ${data.senderName}`
          : `${count} new messages from ${data.senderName}`;
      const url = this.messagesUrl(
        data.recipientRole as UserType,
        data.chatroomId,
      );

      const notification = await this.createNotification({
        recipientId: data.recipientId,
        type: NotificationType.NEW_MESSAGE,
        title,
        body: lastPreview,
        url,
        metadata: { chatroomId: data.chatroomId, senderId: data.senderId },
      });

      const hasPush = await this.pushService.hasSubscription(data.recipientId);

      if (hasPush) {
        void this.pushService.sendToUser(data.recipientId, {
          title: notification.title,
          body: notification.body,
          url: notification.url,
        });
      } else {
        const lastSeenMs = data.recipientLastSeenAt
          ? new Date(data.recipientLastSeenAt).getTime()
          : 0;
        const isLongAbsent =
          !data.recipientLastSeenAt || Date.now() - lastSeenMs > ONE_HOUR_MS;

        if (isLongAbsent) {
          await this.scheduleEmailBatch(
            {
              id: data.recipientId,
              email: data.recipientEmail,
              firstName: data.recipientFirstName,
            },
            {
              senderName: data.senderName,
              preview: lastPreview,
              chatroomId: data.chatroomId,
            },
          );
        }
      }

      return notification;
    } catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`deliverMsgNotificationBatch failed: ${err?.message}`);
      return null;
    }
  }

  /**
   * Triggered by ChatsController when a sponsor starts a new chat.
   * New chatroom is a discrete one-time event — no debounce, fires immediately.
   * Returns the Notification so the caller can emit it over WS.
   */
  async notifyNewChatroom(
    dto: NotifyNewChatroomDto,
  ): Promise<Notification | null> {
    try {
      const recipient = await this.userRepo.findOne({
        where: { id: dto.recipientId },
        select: ['id', 'email', 'firstName', 'role'],
      });
      if (!recipient) return null;

      const url = this.messagesUrl(recipient.role, dto.chatroomId);

      const notification = await this.createNotification({
        recipientId: dto.recipientId,
        type: NotificationType.NEW_CHATROOM,
        title: `${dto.sponsorName} started a chat with you`,
        body: 'Tap to view the conversation',
        url,
        metadata: { chatroomId: dto.chatroomId },
      });

      const hasPush = await this.pushService.hasSubscription(dto.recipientId);

      if (hasPush) {
        void this.pushService.sendToUser(dto.recipientId, {
          title: notification.title,
          body: notification.body,
          url: notification.url,
        });
      } else {
        const isLongAbsent =
          !dto.recipientLastSeenAt ||
          Date.now() - new Date(dto.recipientLastSeenAt).getTime() >
            ONE_HOUR_MS;

        if (isLongAbsent) {
          await this.scheduleEmailBatch(recipient, {
            senderName: dto.sponsorName,
            preview: 'Tap to view the conversation',
            chatroomId: dto.chatroomId,
          });
        }
      }

      return notification;
    } catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`notifyNewChatroom failed: ${err?.message}`);
      return null;
    }
  }

  // ─── Notification CRUD (REST API) ────────────────────────────────────────────

  async getNotifications(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    notifications: Notification[];
    unreadCount: number;
    total: number;
  }> {
    const [notifications, total] = await this.notifRepo.findAndCount({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const unreadCount = await this.notifRepo.count({
      where: { recipientId: userId, isRead: false },
    });

    return { notifications, unreadCount, total };
  }

  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    const notif = await this.notifRepo.findOne({
      where: { id: notificationId, recipientId: userId },
    });
    if (!notif) return null;
    notif.isRead = true;
    notif.readAt = new Date();
    return this.notifRepo.save(notif);
  }

  async markAllRead(userId: string): Promise<void> {
    const now = new Date();
    await this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: now })
      .where('recipientId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  /**
   * Mark all NEW_MESSAGE notifications for a chatroom as read.
   * Called when the user emits messages_read for that chatroom.
   * Returns the IDs that were marked so the caller can emit back to the client.
   */
  async markChatroomNotificationsRead(
    userId: string,
    chatroomId: string,
  ): Promise<string[]> {
    const unread = await this.notifRepo.find({
      where: {
        recipientId: userId,
        type: NotificationType.NEW_MESSAGE,
        isRead: false,
      },
      select: ['id', 'metadata'],
    });

    const toMark = unread.filter(
      (n) => (n.metadata as Record<string, unknown>)?.chatroomId === chatroomId,
    );
    if (!toMark.length) return [];

    const ids = toMark.map((n) => n.id);
    const now = new Date();
    await this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: now })
      .whereInIds(ids)
      .execute();

    return ids;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async createNotification(data: {
    recipientId: string;
    type: NotificationType;
    title: string;
    body: string;
    url: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification> {
    const notif = this.notifRepo.create({
      ...data,
      isRead: false,
      readAt: null,
      metadata: data.metadata ?? null,
    });
    return this.notifRepo.save(notif);
  }

  /**
   * Queue/debounce a message notification for a recipient+chatroom pair.
   *
   * - jobId = msg-notif:{recipientId}:{chatroomId} — unique per chatroom
   * - Debounce: each new message resets the 30 s clock
   * - Hard cap: total wait never exceeds 5 min from first message
   */
  private async scheduleMsgNotificationBatch(
    recipient: Pick<User, 'id' | 'email' | 'firstName' | 'role'>,
    opts: {
      chatroomId: string;
      senderId: string;
      senderName: string;
      preview: string;
      recipientLastSeenAt: Date | null;
    },
  ): Promise<void> {
    const jobId = `msg-notif:${recipient.id}:${opts.chatroomId}`;
    const now = Date.now();
    const newEntry: MsgBatchEntry = {
      preview: opts.preview,
      sentAt: new Date(now).toISOString(),
    };

    try {
      const existingJob = await this.notifQueue.getJob(jobId);

      if (existingJob) {
        const firstMessageAt: number =
          (existingJob.data as MsgNotificationBatchJobData).firstMessageAt ??
          existingJob.timestamp;
        const elapsed = now - firstMessageAt;
        // Debounce resets to 30 s, but never past the hard cap from first message
        const delay = Math.max(
          0,
          Math.min(this.MSG_DEBOUNCE_MS, this.MSG_HARD_CAP_MS - elapsed),
        );
        const accumulated: MsgBatchEntry[] = [
          ...(existingJob.data as MsgNotificationBatchJobData).messages,
          newEntry,
        ];

        await existingJob.remove();
        await this.notifQueue.add(
          NotificationJobs.MSG_NOTIFICATION_BATCH,
          {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            recipientFirstName: recipient.firstName,
            recipientRole: recipient.role,
            chatroomId: opts.chatroomId,
            senderId: opts.senderId,
            senderName: opts.senderName,
            messages: accumulated,
            firstMessageAt,
            recipientLastSeenAt:
              opts.recipientLastSeenAt?.toISOString() ?? null,
          } satisfies MsgNotificationBatchJobData,
          { jobId, delay },
        );
      } else {
        await this.notifQueue.add(
          NotificationJobs.MSG_NOTIFICATION_BATCH,
          {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            recipientFirstName: recipient.firstName,
            recipientRole: recipient.role,
            chatroomId: opts.chatroomId,
            senderId: opts.senderId,
            senderName: opts.senderName,
            messages: [newEntry],
            firstMessageAt: now,
            recipientLastSeenAt:
              opts.recipientLastSeenAt?.toISOString() ?? null,
          } satisfies MsgNotificationBatchJobData,
          { jobId, delay: this.MSG_DEBOUNCE_MS },
        );
      }
    } catch (err: any) {
      this.logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `scheduleMsgNotificationBatch failed for ${jobId}: ${err?.message}`,
      );
    }
  }

  /**
   * Schedule or update a batched email job for an offline user.
   * jobId = email-batch:{userId} — deduplication across all chatrooms per user.
   */
  private async scheduleEmailBatch(
    recipient: Pick<User, 'id' | 'email' | 'firstName'>,
    message: EmailBatchMessage,
  ): Promise<void> {
    const jobId = `email-batch:${recipient.id}`;

    try {
      const existingJob = await this.notifQueue.getJob(jobId);

      if (existingJob) {
        const elapsed = Date.now() - existingJob.timestamp;
        const remaining = Math.max(0, this.EMAIL_DELAY_MS - elapsed);
        const accumulatedMessages: EmailBatchMessage[] = [
          ...((existingJob.data as EmailBatchJobData)?.messages ?? []),
          message,
        ];
        await existingJob.remove();
        await this.notifQueue.add(
          NotificationJobs.SEND_EMAIL_BATCH,
          {
            userId: recipient.id,
            userEmail: recipient.email,
            userName: recipient.firstName,
            messages: accumulatedMessages,
          } satisfies EmailBatchJobData,
          { jobId, delay: remaining },
        );
      } else {
        await this.notifQueue.add(
          NotificationJobs.SEND_EMAIL_BATCH,
          {
            userId: recipient.id,
            userEmail: recipient.email,
            userName: recipient.firstName,
            messages: [message],
          } satisfies EmailBatchJobData,
          { jobId, delay: this.EMAIL_DELAY_MS },
        );
      }
    } catch (err: any) {
      this.logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `scheduleEmailBatch failed for userId=${recipient.id}: ${err?.message}`,
      );
    }
  }

  /** Build the deep-link URL based on the user's role */
  private messagesUrl(role: UserType, chatroomId: string): string {
    switch (role) {
      case UserType.SPONSOR:
        return `/sponsor/messages/${chatroomId}`;
      case UserType.STUDENT:
        return `/student/messages/${chatroomId}`;
      default:
        return `/messages/${chatroomId}`;
    }
  }
}
