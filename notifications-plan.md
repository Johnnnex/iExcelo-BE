# Notifications Plan

A unified notification system handling in-app bell updates, PWA push, and email
across the whole platform — chat is the first consumer.

---

## Notification Tiers (in priority order)

```
Tier 1 — In-app (WebSocket)     User is online AND actively in the chatroom
Tier 2 — PWA push               User is online but on a different page
Tier 3 — Email                  User is fully offline (no socket connection)
```

Only ONE delivery tier fires per event for the notification delivery (push / email).
A DB notification record is ALWAYS created regardless of tier.

---

## Decision Logic (corrected)

```
New message arrives for recipientId:

ALWAYS:
  → Create DB Notification record
  → Emit notification_created to user:{recipientId} over WS (updates bell count)
    (This fires even for Tier 1 — they still see the count go up in the nav)

Is recipient's socket connected? (user:{recipientId} room has sockets)
  NO (offline):
    → Tier 3: Schedule batched email job with 10-min delay
    → If another message arrives within the 10-min window:
        Collate with existing job → single email, 10-min window from first message
    → Does recipient have a PWA push subscription?
        YES → Send push immediately (belt-and-suspenders with the email)
        NO  → Email fires after 10 minutes
  YES (online):
    → Is recipient's socket in chatroom:{chatroomId}?
        YES (Tier 1 — actively viewing):
          → WS notification_created already sent → bell count updates
          → SKIP push and email (they see the message live)
        NO (Tier 2 — online, different page):
          → Send PWA push immediately (gets their attention)
          → WS notification_created already sent → bell count updates
          → SKIP email
```

---

## WS Events Summary

| Event | Direction | When |
|-------|-----------|------|
| `new_message` | server → chatroom:{id} | New message saved |
| `new_message_notification` | server → user:{id} | Update messages-list unread badge |
| `notification_created` | server → user:{id} | Bell icon count +1 |
| `messages_read` | server → chatroom:{id} | Blue ticks update |
| `user_typing` | server → chatroom:{id} | Typing indicator |
| `user_status` | server → user:{partnerId} | Online/offline |
| `chatroom_created` | server → user:{id} | New chat started |
| `message_confirmed` | server → sender | Optimistic → real ID |
| `message_failed` | server → sender | DB save failed |

---

## Backend Architecture

### Queue (BullMQ + Redis)

```
NotificationsQueue
  └── 'send_email_batch'  { userId, userEmail, userName, messages[] }  delay: 10 minutes
```

**Collation strategy**: When a new message arrives for the same offline user within the
10-min window, the existing BullMQ job is removed and re-added with:
- Accumulated messages array (old + new)
- Remaining delay (original 10-min window, NOT reset)

This means: if 5 messages arrive in 3 minutes, the user gets ONE email after 10 minutes
from the first message, containing all 5 previews.

When the email job fires, it sends a batched HTML email listing all pending messages.
No stale check needed — the email is informational, not action-blocking.

### PWA Push

Fires immediately when the user is offline or online-but-not-in-chatroom.
No delay, no collation — push is ephemeral and the OS handles display.

### NotificationsModule structure

```
src/notifications/
├── notifications.module.ts
├── notifications.service.ts        — tier decision + dispatch
├── notifications.controller.ts     — push subscription CRUD + notification REST API
├── entities/
│   └── notification.entity.ts      — DB notification record
├── push/
│   ├── push.service.ts             — web-push integration
│   └── push-subscription.entity.ts — endpoint + keys
└── queue/
    ├── notifications.processor.ts  — BullMQ job handlers
    └── notifications.queue.ts      — queue name + job interfaces
```

---

## PWA Push Flow

### Registration (frontend → backend)

```
User logs in
  → SW registers: navigator.serviceWorker.register('/sw.js')
  → PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })
  → POST /notifications/push-subscriptions  { endpoint, keys: { p256dh, auth } }
  → Backend saves PushSubscription entity for this userId
```

### Sending

```typescript
// push.service.ts
webpush.setVapidDetails(
  'mailto:noreply@iexcelo.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Sends to ALL subscriptions for a user (multi-device support)
// Automatically deletes stale subscriptions (HTTP 410)
await pushService.sendToUser(userId, { title, body, url });
```

### Service Worker (frontend — /public/sw.js)

```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

---

## Email Notification Flow

Uses existing `EmailService.sendNewMessagesBatchEmail()`.

**Subject (1 message)**: `New message from {senderName} — iExcelo`
**Subject (N messages)**: `{N} new messages waiting for you — iExcelo`

Body lists each message with sender name, preview, and "Reply →" link.

Conditions for firing:
1. User is offline (no socket)
2. 10 minutes have elapsed since the first unread message
3. Batch collects all messages that arrived within that window

---

## REST API

```
GET    /notifications                      Paginated list + unreadCount
GET    /notifications/unread-count         Bell badge count (lightweight)
PATCH  /notifications/:id/read             Mark single as read
PATCH  /notifications/read-all             Mark all as read
GET    /notifications/vapid-public-key     VAPID public key for PushManager
POST   /notifications/push-subscriptions   Register push subscription
DELETE /notifications/push-subscriptions   Unregister push subscription
```

---

## Notification Types

| Type | Tier 1 (WS bell) | Tier 2 (Push) | Tier 3 (Email) |
|------|-----------------|---------------|----------------|
| NEW_MESSAGE | Always | Online+not in room OR offline | Offline, 10-min batch |
| NEW_CHATROOM | Always | Always (important event) | No (push covers it) |
| SUBSCRIPTION_EXPIRING | WS only | Yes | Yes |
| SUBSCRIPTION_EXPIRED | WS only | Yes | Yes |
| GIVEBACK_ACTIVATED | WS only | Yes | Yes |
| EXAM_RESULT | WS only | Yes | No (noisy) |
| FLAGGED_MESSAGE_REVIEWED | Admin WS only | No | No |

---

## VAPID Key Generation (run once, store in .env)

```bash
npx web-push generate-vapid-keys
```

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # optional
```

The public key is exposed to the frontend via `GET /notifications/vapid-public-key` (safe).
The private key stays server-side only.
