import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './queue/notifications.processor';
import { Notification } from './entities/notification.entity';
import { PushSubscription } from './push/push-subscription.entity';
import { PushService } from './push/push.service';
import { User } from '../users/entities/user.entity';
import { NOTIFICATIONS_QUEUE } from './queue/notifications.queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, PushSubscription, User]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsProcessor,
    PushService,
  ],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
