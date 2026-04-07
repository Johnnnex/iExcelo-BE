export const NOTIFICATIONS_QUEUE = 'notifications';

export const NotificationJobs = {
  SEND_EMAIL_BATCH: 'send_email_batch',
  MSG_NOTIFICATION_BATCH: 'msg_notification_batch',
} as const;

// ─── Email batch ──────────────────────────────────────────────────────────────

export interface EmailBatchJobData {
  /** Recipient user ID — used as the BullMQ jobId for deduplication */
  userId: string;
  /** Recipient email address */
  userEmail: string;
  /** Recipient first name for personalisation */
  userName: string;
  /** Accumulated message previews in this batch */
  messages: EmailBatchMessage[];
}

export interface EmailBatchMessage {
  senderName: string;
  preview: string;
  chatroomId: string;
}

// ─── Message notification batch ───────────────────────────────────────────────

/** One message accumulated inside the debounce window */
export interface MsgBatchEntry {
  preview: string;
  sentAt: string; // ISO string
}

/**
 * Job data for MSG_NOTIFICATION_BATCH.
 * jobId = msg-notif:{recipientId}:{chatroomId} — BullMQ deduplicates per chatroom.
 */
export interface MsgNotificationBatchJobData {
  recipientId: string;
  recipientEmail: string;
  recipientFirstName: string;
  recipientRole: string; // UserType value
  chatroomId: string;
  senderId: string;
  senderName: string;
  /** All accumulated previews in this debounce window */
  messages: MsgBatchEntry[];
  /** Epoch ms of the first message — used to enforce the hard cap */
  firstMessageAt: number;
  /** ISO string or null — for offline email tier decision */
  recipientLastSeenAt: string | null;
}
