import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { PushService } from './push/push.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

class RegisterPushSubscriptionDto {
  @IsString()
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

class UnregisterPushSubscriptionDto {
  @IsString()
  endpoint: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  // ─── Notification list ────────────────────────────────────────────────────

  /**
   * GET /notifications
   * Returns paginated notifications for the current user + total unread count.
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getNotifications(
      user.id,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * GET /notifications/unread-count
   * Lightweight poll endpoint for bell badge.
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read.
   */
  @Patch(':id/read')
  async markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.markRead(id, user.id);
  }

  /**
   * PATCH /notifications/read-all
   * Mark ALL notifications for the current user as read.
   */
  @Patch('read-all')
  async markAllRead(@CurrentUser() user: User) {
    await this.notificationsService.markAllRead(user.id);
  }

  // ─── Push subscriptions ───────────────────────────────────────────────────

  /**
   * POST /notifications/push-subscriptions
   * Register a browser's Web Push subscription.
   * Called by the frontend after PushManager.subscribe().
   */
  @Post('push-subscriptions')
  async registerPushSubscription(
    @CurrentUser() user: User,
    @Body() body: RegisterPushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    const sub = await this.pushService.saveSubscription(
      user.id,
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
      userAgent,
    );
    return { id: sub.id, endpoint: sub.endpoint };
  }

  /**
   * DELETE /notifications/push-subscriptions
   * Unregister a push subscription (user logs out or revokes permission).
   */
  @Delete('push-subscriptions')
  async unregisterPushSubscription(
    @CurrentUser() user: User,
    @Body() body: UnregisterPushSubscriptionDto,
  ) {
    await this.pushService.deleteSubscription(user.id, body.endpoint);
  }

  /**
   * GET /notifications/vapid-public-key
   * Returns the VAPID public key for the frontend to use with PushManager.subscribe().
   */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
  }
}
