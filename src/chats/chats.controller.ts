import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { buildPreview } from './preview.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatMessage } from './entities/chat-message.entity';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { FlagMessageDto } from './dto/flag-message.dto';
import {
  GetMessagesDto,
  GetChatroomsDto,
  GetPresenceDto,
  SearchStudentsDto,
} from './dto/get-messages.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserType } from '../../types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatsGateway: ChatsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Chatrooms ────────────────────────────────────────────────────────────

  /** List all chatrooms for the current user, paginated */
  @Get('chatrooms')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  getChatrooms(@CurrentUser() user: User, @Query() dto: GetChatroomsDto) {
    return this.chatsService.getChatrooms(
      user.id,
      dto.limit ?? 20,
      dto.cursor,
      dto.query,
    );
  }

  /**
   * Sponsor opens compose modal → selects students → sends initial message.
   * Creates one chatroom per student (idempotent — returns existing if already open).
   * Emits `chatroom_created` WS event to each student.
   */
  @Post('chatrooms')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  async createChatrooms(
    @CurrentUser() user: User,
    @Body() dto: CreateChatroomDto,
  ) {
    const results = await Promise.all(
      dto.studentUserIds.map(async (studentUserId) => {
        const { chatroom, isNew } = await this.chatsService.getOrCreateChatroom(
          user.id,
          studentUserId,
        );

        // Optionally send an initial message
        let firstMessage: ChatMessage | null = null;
        if (dto.initialMessage) {
          firstMessage = await this.chatsService.saveMessage(
            chatroom.id,
            user.id,
            dto.initialMessage,
          );
        }

        // Snapshot student socket state + presence for tier decision
        const [studentSockets, studentPresences] = await Promise.all([
          this.chatsGateway.server.in(`user:${studentUserId}`).fetchSockets(),
          this.chatsService.getPresence([studentUserId]),
        ]);
        const isStudentOnline = studentSockets.length > 0;
        const studentPresence = studentPresences[0];
        const studentLastSeenAt = studentPresence?.lastSeenAt
          ? new Date(studentPresence.lastSeenAt)
          : null;

        const senderName = `${user.firstName} ${user.lastName}`.trim();

        if (isNew) {
          // Brand-new chatroom: notify student that a conversation was started
          this.chatsGateway.notifyNewChatroom(studentUserId, {
            chatroom: { id: chatroom.id, type: chatroom.type },
            message: firstMessage
              ? {
                  id: firstMessage.id,
                  senderId: firstMessage.senderId,
                  content: firstMessage.content,
                  createdAt: firstMessage.createdAt,
                }
              : null,
          });

          void this.notificationsService
            .notifyNewChatroom({
              recipientId: studentUserId,
              sponsorName: senderName,
              chatroomId: chatroom.id,
              recipientLastSeenAt: studentLastSeenAt,
            })
            .then((notification) => {
              if (notification && isStudentOnline) {
                this.chatsGateway.server
                  .to(`user:${studentUserId}`)
                  .emit('notification_created', {
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    body: notification.body,
                    url: notification.url,
                    isRead: false,
                    createdAt: notification.createdAt,
                  });
              }
            });
        } else if (firstMessage) {
          // Existing chatroom + new message: treat exactly like a sent message
          const preview = buildPreview(firstMessage.content);
          this.chatsGateway.server
            .to(`user:${studentUserId}`)
            .emit('new_message_notification', {
              chatroomId: chatroom.id,
              senderId: user.id,
              preview,
              createdAt: firstMessage.createdAt,
            });

          void this.notificationsService.notifyNewMessage({
            chatroomId: chatroom.id,
            senderId: user.id,
            recipientId: studentUserId,
            preview,
            isRecipientInChatroom: false,
            recipientLastSeenAt: studentLastSeenAt,
          });
        }

        return { chatroomId: chatroom.id, studentUserId, firstMessage };
      }),
    );

    return results;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /** Single chatroom by ID — used when navigating directly via notification link */
  @Get('chatrooms/:chatroomId')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  getChatroomById(
    @CurrentUser() user: User,
    @Param('chatroomId') chatroomId: string,
  ) {
    return this.chatsService.getChatroomById(chatroomId, user.id);
  }

  /** Paginated message history — cursor (before=messageId) scrolls upward */
  @Get('chatrooms/:chatroomId/messages')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  getMessages(
    @CurrentUser() user: User,
    @Param('chatroomId') chatroomId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatsService.getMessages(
      chatroomId,
      user.id,
      dto.before,
      dto.limit,
    );
  }

  /** Total unread count across all chatrooms — for page title hydration */
  @Get('unread-count')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  async getTotalUnread(@CurrentUser() user: User) {
    const count = await this.chatsService.getTotalUnread(user.id);
    return { count };
  }

  // ─── Flagging ─────────────────────────────────────────────────────────────

  @Post('messages/:messageId/flag')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  async flagMessage(
    @CurrentUser() user: User,
    @Param('messageId') messageId: string,
    @Body() dto: FlagMessageDto,
  ) {
    const result = await this.chatsService.flagMessage(
      messageId,
      user.id,
      dto.reason,
    );
    // Notify chatroom room so the other participant sees the flag immediately
    this.chatsGateway.server
      .to(`chatroom:${result.message.chatroomId}`)
      .emit('message_flagged', {
        chatroomId: result.message.chatroomId,
        messageId: result.message.id,
        flagReason: result.flag.reason ?? null,
      });
    return result;
  }

  // ─── Presence ─────────────────────────────────────────────────────────────

  /** Batch presence lookup — used when opening the chatroom list page */
  @Get('presence')
  @Roles(UserType.SPONSOR, UserType.STUDENT)
  getPresence(@Query() dto: GetPresenceDto) {
    const ids = dto.userIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50); // hard cap
    return this.chatsService.getPresence(ids);
  }

  // ─── Sponsor compose modal ────────────────────────────────────────────────

  /**
   * Returns the sponsor's own students for the compose modal.
   * Default: 5 most recent. With ?query=: search by name/email.
   */
  @Get('sponsor/students')
  @Roles(UserType.SPONSOR)
  searchStudents(@CurrentUser() user: User, @Query() dto: SearchStudentsDto) {
    return this.chatsService.searchSponsorStudents(
      user.id,
      dto.query,
      dto.limit,
    );
  }

  /**
   * Student compose modal — search users by email prefix.
   * Only returns up to 5 results. Excludes the searching user.
   */
  @Get('users/search')
  @Roles(UserType.STUDENT, UserType.SPONSOR)
  async searchUsers(@CurrentUser() user: User, @Query('email') email: string) {
    if (!email || email.length < 3) return [];
    return this.chatsService.searchUsersByEmail(email, user.id);
  }
}
