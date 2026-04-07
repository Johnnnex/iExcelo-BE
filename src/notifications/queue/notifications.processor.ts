import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../../email/email.service';
import { NotificationsService } from '../notifications.service';
import { NotificationsGateway } from '../notifications.gateway';
import {
  NOTIFICATIONS_QUEUE,
  NotificationJobs,
  EmailBatchJobData,
  MsgNotificationBatchJobData,
} from './notifications.queue';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NotificationJobs.SEND_EMAIL_BATCH:
        await this.handleEmailBatch(job as Job<EmailBatchJobData>);
        break;
      case NotificationJobs.MSG_NOTIFICATION_BATCH:
        await this.handleMsgNotificationBatch(
          job as Job<MsgNotificationBatchJobData>,
        );
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async handleEmailBatch(job: Job<EmailBatchJobData>): Promise<void> {
    const { userId, userEmail, userName, messages } = job.data;
    this.logger.log(
      `Sending email batch to userId=${userId} (${messages.length} message(s))`,
    );
    try {
      await this.emailService.sendNewMessagesBatchEmail(
        userEmail,
        userName,
        messages,
      );
    } catch (err: any) {
      this.logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Email batch failed for userId=${userId}: ${err?.message}`,
      );
      throw err; // BullMQ will retry
    }
  }

  private async handleMsgNotificationBatch(
    job: Job<MsgNotificationBatchJobData>,
  ): Promise<void> {
    const { recipientId, chatroomId, messages } = job.data;
    this.logger.log(
      `Delivering msg notification batch to userId=${recipientId}, chatroomId=${chatroomId} (${messages.length} message(s))`,
    );

    const notification =
      await this.notificationsService.deliverMsgNotificationBatch(job.data);

    if (notification) {
      // Emit to recipient's personal WS room so the bell icon updates in real-time
      // (no-op if recipient is offline — they'll see it on next getNotifications call)
      this.notificationsGateway.emitToUser(
        recipientId,
        'notification_created',
        {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          url: notification.url,
          isRead: false,
          createdAt: notification.createdAt,
        },
      );
    }
  }
}
