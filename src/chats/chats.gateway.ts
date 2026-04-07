import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UseFilters } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPreview } from './preview.util';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId: string;
}

// ─── WS Exception Filter ──────────────────────────────────────────────────────

import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';

@Catch()
class AllWsExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    super.catch(exception, host);
  }
}

import { BANNED_WORDS_RE } from './content-policy';

// ─── Gateway ─────────────────────────────────────────────────────────────────

@UseFilters(AllWsExceptionsFilter)
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chats',
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatsService: ChatsService,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new WsException('No token provided');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      socket.userId = payload.sub as string;

      // Join personal room — server pushes presence + notifications here
      void socket.join(`user:${socket.userId}`);

      // Mark user online in DB
      await this.chatsService.setOnline(socket.userId, true);

      // Broadcast online status to all chat partners
      const partnerIds = await this.chatsService.getChatPartnerIds(
        socket.userId,
      );
      for (const partnerId of partnerIds) {
        this.server.to(`user:${partnerId}`).emit('user_status', {
          userId: socket.userId,
          isOnline: true,
          lastSeenAt: null,
        });
      }

      socket.emit('connection_ack', { userId: socket.userId });
    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    const presence = await this.chatsService.setOnline(socket.userId, false);

    // Broadcast offline status + last-seen to all chat partners
    const partnerIds = await this.chatsService.getChatPartnerIds(socket.userId);
    for (const partnerId of partnerIds) {
      this.server.to(`user:${partnerId}`).emit('user_status', {
        userId: socket.userId,
        isOnline: false,
        lastSeenAt: presence.lastSeenAt,
      });
    }
  }

  // ─── Chatroom room management ────────────────────────────────────────────

  @SubscribeMessage('join_chatroom')
  async handleJoinChatroom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatroomId: string },
  ) {
    try {
      await this.chatsService.assertParticipant(data.chatroomId, socket.userId);
      void socket.join(`chatroom:${data.chatroomId}`);
      return { event: 'joined', chatroomId: data.chatroomId };
    } catch {
      throw new WsException('Cannot join chatroom');
    }
  }

  @SubscribeMessage('leave_chatroom')
  handleLeaveChatroom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatroomId: string },
  ) {
    void socket.leave(`chatroom:${data.chatroomId}`);
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()
    data: { chatroomId: string; content: string; tempId: string },
  ) {
    if (!data.content?.trim())
      throw new WsException('Message content is empty');

    // Content policy check — reject before broadcast or DB write
    if (BANNED_WORDS_RE.test(data.content)) {
      socket.emit('message_restricted', {
        tempId: data.tempId,
        chatroomId: data.chatroomId,
      });
      return;
    }

    const preview = buildPreview(data.content);
    const optimisticTs = new Date().toISOString();

    // 1. Snapshot recipient socket state + presence BEFORE broadcast
    const recipients = await this.chatsService.getChatroomRecipients(
      data.chatroomId,
      socket.userId,
    );
    const [presences, socketSnapshots] = await Promise.all([
      this.chatsService.getPresence(recipients),
      Promise.all(
        recipients.map(async (id) => ({
          id,
          sockets: await this.server.in(`user:${id}`).fetchSockets(),
        })),
      ),
    ]);
    const recipientTiers = socketSnapshots.map(({ id, sockets }) => {
      const isOnline = sockets.length > 0;
      const isInChatroom = sockets.some((s) =>
        s.rooms.has(`chatroom:${data.chatroomId}`),
      );
      const presence = presences.find((p) => p.userId === id);
      return {
        recipientId: id,
        isOnline,
        isInChatroom, // used for push notification suppression
        lastSeenAt: presence?.lastSeenAt ? new Date(presence.lastSeenAt) : null,
      };
    });

    // 2. Broadcast to chatroom immediately — user experience first
    const optimisticPayload = {
      tempId: data.tempId,
      chatroomId: data.chatroomId,
      senderId: socket.userId,
      content: data.content,
      deliveryStatus: 'sent',
      createdAt: optimisticTs,
    };
    socket
      .to(`chatroom:${data.chatroomId}`)
      .emit('new_message', optimisticPayload);

    // 3. Real-time notification signal to all recipients' personal rooms
    //    (updates unread badge + last-message preview on the messages list page)
    for (const { recipientId } of recipientTiers) {
      this.server.to(`user:${recipientId}`).emit('new_message_notification', {
        chatroomId: data.chatroomId,
        senderId: socket.userId,
        preview,
        createdAt: optimisticTs,
      });
    }

    // 4. Persist to DB
    try {
      const saved = await this.chatsService.saveMessage(
        data.chatroomId,
        socket.userId,
        data.content,
      );

      // 5. Confirm to sender — replace optimistic bubble with real DB id
      socket.emit('message_confirmed', {
        tempId: data.tempId,
        message: {
          id: saved.id,
          tempId: data.tempId,
          chatroomId: saved.chatroomId,
          senderId: saved.senderId,
          content: saved.content,
          deliveryStatus: saved.deliveryStatus,
          createdAt: saved.createdAt,
        },
      });

      // 6. Push real DB id to ALL participants in the room.
      //    Recipients received the optimistic broadcast with no id — without this
      //    they can never flag (or reference) the message by its DB id.
      this.server
        .to(`chatroom:${data.chatroomId}`)
        .emit('message_id_assigned', {
          tempId: data.tempId,
          id: saved.id,
          chatroomId: data.chatroomId,
        });

      // 7. Notifications: queue debounced job (or cancel if recipient is in chatroom)
      //    DB record + push + WS emit happen when the job fires (NotificationsProcessor)
      for (const { recipientId, isInChatroom, lastSeenAt } of recipientTiers) {
        void this.notificationsService.notifyNewMessage({
          chatroomId: data.chatroomId,
          senderId: socket.userId,
          recipientId,
          preview,
          isRecipientInChatroom: isInChatroom,
          recipientLastSeenAt: lastSeenAt,
        });
      }
    } catch {
      socket.emit('message_failed', {
        tempId: data.tempId,
        chatroomId: data.chatroomId,
      });
    }
  }

  // ─── Typing indicators ───────────────────────────────────────────────────

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatroomId: string },
  ) {
    const payload = {
      userId: socket.userId,
      chatroomId: data.chatroomId,
      typing: true,
    };
    // Users inside the open chat room
    socket.to(`chatroom:${data.chatroomId}`).emit('user_typing', payload);
    // Users on the chatroom list page (not in the chatroom WS room)
    const recipients = await this.chatsService.getChatroomRecipients(
      data.chatroomId,
      socket.userId,
    );
    for (const recipientId of recipients) {
      this.server.to(`user:${recipientId}`).emit('user_typing', payload);
    }
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatroomId: string },
  ) {
    const payload = {
      userId: socket.userId,
      chatroomId: data.chatroomId,
      typing: false,
    };
    socket.to(`chatroom:${data.chatroomId}`).emit('user_typing', payload);
    const recipients = await this.chatsService.getChatroomRecipients(
      data.chatroomId,
      socket.userId,
    );
    for (const recipientId of recipients) {
      this.server.to(`user:${recipientId}`).emit('user_typing', payload);
    }
  }

  // ─── Read receipts ────────────────────────────────────────────────────────

  @SubscribeMessage('messages_read')
  async handleMessagesRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatroomId: string },
  ) {
    try {
      // DB write — idempotent (skipped if already fully read)
      const result = await this.chatsService.markRead(
        data.chatroomId,
        socket.userId,
      );

      if (result.skipped) {
        // Already fully read — ack the client so it stops retrying, but no broadcast
        return { success: true, readAt: result.readAt };
      }

      const readPayload = {
        chatroomId: data.chatroomId,
        userId: socket.userId,
        readAt: result.readAt,
      };

      // Broadcast to chatroom room (covers sender if they're actively viewing chat)
      this.server
        .to(`chatroom:${data.chatroomId}`)
        .emit('messages_read', readPayload);

      // Also emit to each sender's personal room so ticks update even after navigation
      for (const senderId of result.senderIds ?? []) {
        this.server.to(`user:${senderId}`).emit('messages_read', readPayload);
      }

      // Cancel any pending notification job for this chatroom — user has seen the messages
      void this.notificationsService.cancelChatroomNotification(
        socket.userId,
        data.chatroomId,
      );

      // Mark any already-delivered NEW_MESSAGE notifications as read + update bell
      void this.notificationsService
        .markChatroomNotificationsRead(socket.userId, data.chatroomId)
        .then((ids) => {
          if (ids.length) {
            this.server
              .to(`user:${socket.userId}`)
              .emit('notifications_marked_read', { ids });
          }
        });

      // Ack: client retries if this never arrives
      return { success: true, readAt: result.readAt };
    } catch {
      return { success: false };
    }
  }

  // ─── Helpers (called from REST controller) ───────────────────────────────

  /** Notify a user's personal room about a new chatroom being created */
  notifyNewChatroom(userId: string, payload: object) {
    this.server.to(`user:${userId}`).emit('chatroom_created', payload);
  }
}
