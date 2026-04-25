# Admin Message Notification Name

When an admin or trainer sends a chat message to a user, the user notification title now uses the fixed admin display name:

```text
New message from coach mahmoud ali
```

This applies to both chat send flows:

- REST: `POST /api/v1/chat/users/:userId/messages`
- Socket.IO: `chat:send`

The message preview remains the notification body. For text messages, the body is the message text preview. For media-only messages, the body is an attachment preview such as `[Image]` or `[2 attachments]`.

Implementation detail:

- The display name is centralized in `ADMIN_CHAT_NOTIFICATION_DISPLAY_NAME` in `src/modules/notification/v1/notification.service.ts`.
- `NotificationService.notifyUserAboutAdminMessage` builds the notification title with that fixed name.
