import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  icon?: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushSubRepo: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not set — PWA push notifications are disabled',
      );
      return;
    }

    webpush.setVapidDetails(
      `mailto:${this.configService.get('SMTP_FROM', 'noreply@iexcelo.com')}`,
      publicKey,
      privateKey,
    );
  }

  // ─── Subscription CRUD ──────────────────────────────────────────────────────

  async saveSubscription(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
  ): Promise<PushSubscription> {
    const existing = await this.pushSubRepo.findOne({ where: { endpoint } });
    if (existing) {
      // Update userId (e.g. after re-login on same browser)
      existing.userId = userId;
      existing.p256dh = p256dh;
      existing.auth = auth;
      if (userAgent) existing.userAgent = userAgent;
      return this.pushSubRepo.save(existing);
    }
    const sub = this.pushSubRepo.create({
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent ?? undefined,
    });
    return this.pushSubRepo.save(sub);
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.pushSubRepo.delete({ userId, endpoint });
  }

  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.pushSubRepo.find({ where: { userId } });
  }

  async hasSubscription(userId: string): Promise<boolean> {
    const count = await this.pushSubRepo.count({ where: { userId } });
    return count > 0;
  }

  // ─── Sending ─────────────────────────────────────────────────────────────────

  /**
   * Send a push notification to ALL subscriptions for a user.
   * Silently removes expired subscriptions (HTTP 410 from push provider).
   * Returns true if at least one push was sent successfully.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<boolean> {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    if (!publicKey) {
      this.logger.warn('sendToUser: VAPID_PUBLIC_KEY not set — push skipped');
      return false;
    }

    const subscriptions = await this.pushSubRepo.find({ where: { userId } });
    if (!subscriptions.length) {
      this.logger.debug(`sendToUser: no subscriptions for userId=${userId}`);
      return false;
    }
    this.logger.debug(
      `sendToUser: sending to userId=${userId} (${subscriptions.length} sub(s)): ${payload.title}`,
    );

    let sent = false;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
          sent = true;
          this.logger.debug(
            `Push delivered OK for userId=${userId} endpoint=...${sub.endpoint.slice(-40)}`,
          );
        } catch (err: any) {
          /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
          const status = err?.statusCode ?? err?.status ?? 'unknown';
          const body = err?.body ?? err?.response?.body ?? '';
          this.logger.error(
            `Push failed for userId=${userId} endpoint=${sub.endpoint.slice(-30)}: status=${status} msg=${err?.message} body=${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`,
          );
          // 410 Gone / 404 Not Found = subscription expired or unsubscribed
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            this.logger.warn(
              `Removing stale subscription for userId=${userId}`,
            );
            await this.pushSubRepo.delete(sub.id);
          }
          /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        }
      }),
    );
    return sent;
  }
}
