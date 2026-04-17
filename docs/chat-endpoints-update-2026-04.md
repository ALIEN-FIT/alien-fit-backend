# Chat Endpoints Update (April 2026)

This file documents the recent chat API and Socket.IO changes in the backend.

## 1) `GET /api/v1/chat/users` updates

Endpoint:

```http
GET /api/v1/chat/users
Authorization: Bearer <trainer-or-admin-token>
```

### Optional query params

You can now filter chats using any of these query params:

```http
GET /api/v1/chat/users?active=true
GET /api/v1/chat/users?validSubscription=true
GET /api/v1/chat/users?active=false&validSubscription=false
GET /api/v1/chat/users?status=active_valid
GET /api/v1/chat/users?status=inactive_valid
GET /api/v1/chat/users?status=inactive_invalid
```

Rules:
- `active` is based on user online status.
- `validSubscription` means the user has a non-frozen active subscription and the subscription end date is still valid.
- `status` is a shortcut filter:
  - `active_valid`
  - `inactive_valid`
  - `inactive_invalid`

### New fields returned per chat

Each item in `data` now includes richer user and last-message details.

Response example:

```json
{
  "status": "success",
  "data": [
    {
      "id": "c7ab1e62-2a85-49f5-a1b7-744b7b0cf2d0",
      "user": {
        "id": "f5d1b2c6-5f3f-403a-a84b-12e42054d8fd",
        "name": "Alien User",
        "provider": "+201234567890",
        "gender": "male",
        "imageId": "7ef6a994-c4a8-43a6-b5bf-5db315c7c113",
        "isOnline": true,
        "lastSeen": "2026-04-17T12:01:22.000Z",
        "active": true,
        "validSubscription": true,
        "subscription": {
          "isActive": true,
          "isSubscribed": true,
          "isFrozen": false,
          "startDate": "2026-04-01T00:00:00.000Z",
          "endDate": "2026-05-01T00:00:00.000Z",
          "planType": "both",
          "valid": true
        }
      },
      "lastMessageAt": "2026-04-17T12:01:22.000Z",
      "lastMessagePreview": "[Attachment]",
      "lastMessage": {
        "id": "deef0419-7f4d-4ddf-ac18-f3b7ce3200f4",
        "chatId": "c7ab1e62-2a85-49f5-a1b7-744b7b0cf2d0",
        "senderId": "f5d1b2c6-5f3f-403a-a84b-12e42054d8fd",
        "senderRole": "user",
        "parentMessageId": null,
        "messageType": "text",
        "content": "",
        "createdAt": "2026-04-17T12:01:22.000Z",
        "mediaType": "image",
        "mediaTypes": ["image"],
        "hasMedia": true
      },
      "presence": {
        "online": true,
        "lastSeen": "2026-04-17T12:01:22.000Z"
      },
      "unreadCount": 3
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1,
    "unreadChatCounters": {
      "activeValid": 4,
      "inactiveValid": 7,
      "inactiveInvalid": 2
    }
  }
}
```

### Notes

- `user.gender` is now returned.
- `lastMessage.mediaType` returns the first media type on the latest message.
- `lastMessage.mediaTypes` returns all unique media types found on the latest message.
- File uploads use the media model value `document`.
- `meta.unreadChatCounters` counts chats with unread user messages grouped by:
  - active + valid subscription
  - inactive + valid subscription
  - inactive + invalid subscription

## 2) Reply support for chat messages

Replying to messages is now supported in both REST and Socket.IO chat send flows.

### REST: user sends message

```http
POST /api/v1/chat/me/messages
Authorization: Bearer <user-token>
```

Request body:

```json
{
  "content": "This is a reply",
  "parentMessageId": "36b420df-2fd9-42f4-b808-140e871c5041"
}
```

### REST: trainer/admin sends message

```http
POST /api/v1/chat/users/:userId/messages
Authorization: Bearer <trainer-or-admin-token>
```

Request body:

```json
{
  "content": "Reply from trainer",
  "parentMessageId": "36b420df-2fd9-42f4-b808-140e871c5041"
}
```

Rules:
- `parentMessageId` is optional.
- If provided, the parent message must exist in the same chat.
- You can reply with text, media, or both.

## 3) Message response shape updates

When messages are returned from:
- `GET /api/v1/chat/me/messages`
- `GET /api/v1/chat/users/:userId/messages`
- Socket event `chat:message`

they now include reply metadata.

Response example:

```json
{
  "id": "5a71fa8f-f34d-4f79-a56c-c0e168e00d69",
  "chatId": "c7ab1e62-2a85-49f5-a1b7-744b7b0cf2d0",
  "senderId": "f5d1b2c6-5f3f-403a-a84b-12e42054d8fd",
  "senderRole": "user",
  "parentMessageId": "36b420df-2fd9-42f4-b808-140e871c5041",
  "parentMessagePreview": "Original message first 30 chars",
  "reply": {
    "id": "36b420df-2fd9-42f4-b808-140e871c5041",
    "preview": "Original message first 30 chars"
  },
  "messageType": "text",
  "content": "This is a reply",
  "media": [],
  "createdAt": "2026-04-17T12:15:00.000Z",
  "isRead": false
}
```

Reply preview behavior:
- If parent message has text, preview is the first 30 characters.
- If parent message has no text and has one media item, preview is `[Attachment]`.
- If parent message has no text and has multiple media items, preview is `[N attachments]`.

## 4) Socket.IO update

Event:

```text
chat:send
```

New payload example:

```json
{
  "content": "Reply over socket",
  "parentMessageId": "36b420df-2fd9-42f4-b808-140e871c5041"
}
```

Trainer/admin payload example:

```json
{
  "userId": "f5d1b2c6-5f3f-403a-a84b-12e42054d8fd",
  "content": "Reply over socket",
  "parentMessageId": "36b420df-2fd9-42f4-b808-140e871c5041"
}
```

Socket emitted messages now also include:
- `parentMessageId`
- `parentMessagePreview`
- `reply`

## 5) Database migration required

Reply support adds a nullable `parentMessageId` column to `messages`.

Migration file:

```text
src/database/migrations/20260417100000-add-parent-message-id-to-messages.cjs
```

Run:

```bash
npm run migration:up
```
