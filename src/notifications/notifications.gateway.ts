import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

/**
 * Thin gateway on the shared /chats namespace.
 * Only purpose: emit server-push events (notification_created) from within
 * NotificationsModule without creating a circular dependency on ChatsGateway.
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chats',
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  emitToUser(userId: string, event: string, payload: object) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
