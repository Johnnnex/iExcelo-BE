import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { Chatroom } from './entities/chatroom.entity';
import { ChatroomParticipant } from './entities/chatroom-participant.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { UserPresence } from './entities/user-presence.entity';
import { MessageFlag } from './entities/message-flag.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Chatroom,
      ChatroomParticipant,
      ChatMessage,
      UserPresence,
      MessageFlag,
    ]),
    // JwtModule so the gateway can verify tokens during WS handshake
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    NotificationsModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService],
})
export class ChatsModule {}
