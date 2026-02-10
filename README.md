# Alien Fit Backend

## 🚀 Chat & Presence Module

This backend now ships with a real-time chat experience between end users and the trainer pool. Every user keeps a single anonymous conversation thread regardless of which trainer responds, and all real-time updates flow through Socket.IO with Redis-backed presence tracking.

### What’s Included

- **Chat persistence** powered by Sequelize models (`ChatEntity`, `MessageEntity`).
- **Role-aware REST API** for users, trainers, and admins under `~/api/v1/chat`.
- **Authenticated Socket.IO gateway** that reuses the JWT flow from the HTTP stack.
- **Redis heartbeat** system that records online state and `lastSeen` timestamps with a new admin-facing counter endpoint.

## ⚙️ Prerequisites

| Dependency | Purpose | Default |
|------------|---------|---------|
| Node.js ≥ 18 | Runtime | — |
| PostgreSQL | Primary database | `env.DB_URI` |
| Redis ≥ 6 | Presence & heartbeat | `redis://localhost:6379/0` |

Update your environment variables (see `.env.example`) with:

```bash
REDIS_URL=redis://localhost:6379/0
```

## � Database Migrations

This project uses Sequelize migrations to manage database schema changes. Migrations are version-controlled and run automatically in Docker.

### Docker (Automatic)

When you start the application with Docker, migrations run automatically:

```bash
# Start with Docker Compose (migrations run on startup)
docker compose up -d

# Or use the start script
./script/start.sh start
```

### Manual Migration Commands

```bash
# Create a new migration
npm run migration:create add-new-field

# Run all pending migrations
npm run migration:up

# Revert last migration
npm run migration:down

# Check migration status
npm run migration:status
```

### Docker Migration Commands

```bash
# Run migrations in Docker container
./script/start.sh migrate

# Check migration status
./script/start.sh migrate:status

# Revert last migration
./script/start.sh migrate:down
```

For detailed information, see:
- [Migration Guide](docs/migrations-guide.md)
- [Docker Migrations Guide](docs/docker-migrations.md)

## �🔌 Socket.IO Contract

All socket connections must send a valid Bearer token via either:

- `Authorization: Bearer <ACCESS_TOKEN>` header, or
- `handshake.auth.token`, or
- `?token=<ACCESS_TOKEN>` query parameter.

### Core Events

| Event | Direction | Payload | Notes |
|-------|-----------|---------|-------|
| `chat:send` | client → server | `{ content: string, userId?: string }` | `userId` required for trainers/admins. |
| `chat:message` | server → client | `{ id, content, createdAt, senderType, isMine? }` | Trainers receive `senderId`/`chatId` as well. |
| `heartbeat` | client → server | — | Send every ~25s to stay online. |

Rooms:

- Users join `chat:<userId>`.
- Trainers/admins join `trainers`.

## 🧭 REST Endpoints (v1)

| Method & Path | Role | Description |
|---------------|------|-------------|
| `GET /chat/me` | User | Retrieve chat metadata + own presence. |
| `GET /chat/me/messages` | User | List chat messages (paginated). |
| `POST /chat/me/messages` | User | Send a message to trainers. |
| `GET /chat/users` | Trainer/Admin | Paginated list of user chats + presence snapshot. |
| `GET /chat/users/:userId/messages` | Trainer/Admin | Fetch conversation with a specific user. |
| `POST /chat/users/:userId/messages` | Trainer/Admin | Reply to a user. |
| `GET /chat/presence/online/count` | Admin | Aggregated online user count. |
| `GET /chat/presence/:userId` | Admin | Presence + last seen for a user. |

All routes are mounted under `/api/v1/chat` and protected by the existing JWT middleware.

## 🏷️ Training Tags: Search

Get all tags supports plain search and regex:

- `search`: case-insensitive contains on `title` and `description`.
- `regex`: case-insensitive regular expression when supported by the DB dialect (PostgreSQL recommended). Falls back gracefully if invalid.

Examples:

```bash
# Plain search
curl -H "Authorization: Bearer $TOKEN" \
	"http://localhost:3000/api/v1/training-videos/tags?search=chest&page=1&limit=20"

# Regex search (Postgres recommended)
curl -H "Authorization: Bearer $TOKEN" \
	"http://localhost:3000/api/v1/training-videos/tags?regex=^(upper|lower).*&sortBy=title&sortDirection=asc"
```

Query params:

- `page` (number, default 1)
- `limit` (number, default 25)
- `sortBy` (`createdAt` | `title`, default `title`)
- `sortDirection` (`asc` | `desc`, default `asc`)

Response:

```json
{
	"tags": [{"id":"…","title":"Chest","description":null,"imageId":"…"}],
	"pagination": {"page":1,"limit":20,"totalItems":42,"totalPages":3}
}
```

## 🍽️ Diet Plan: Weekly Template Payload

Admins can create a 4-week diet plan from a 7-day template. Each day has any number of meals; each meal has a name and foods list with nutrition. A recommended daily water intake (ml) can be set.

Endpoint: `POST /api/v1/plans/diet/week/:userId`

Request body:

```json
{
	"startDate": "2025-01-01",
	"recommendedWaterIntakeMl": 2500,
	"days": [
		{
			"dayNumber": 1,
			"meals": [
				{
					"mealName": "Breakfast",
					"order": 1,
					"foods": [
						{ "name": "Oats", "grams": 80, "calories": 300, "fats": 5, "carbs": 54 },
						{ "name": "Greek Yogurt", "grams": 150, "calories": 160, "fats": 4, "carbs": 8 }
					]
				},
				{
					"mealName": "Lunch",
					"order": 2,
					"foods": [
						{ "name": "Chicken Breast", "grams": 200, "calories": 330, "fats": 4, "carbs": 0 },
						{ "name": "Rice", "grams": 180, "calories": 240, "fats": 1, "carbs": 52 }
					]
				}
			]
		}
		/* … provide 7 day templates … */
	]
}
```

Notes:

- `days` must contain exactly 7 entries (1..7). If `dayNumber` is omitted, index is used.
- The 7-day template is repeated to generate 28 days.
- Response returns weeks → days → meals with foods, plus `recommendedWaterIntakeMl`.

## 🏋️ Training Plan: Weekly Template Payload

Admins can create a 4-week training plan from a 7-day template. Items support multiple types:

- `REGULAR`: single exercise with `sets` and `repeats`.
- `SUPERSET`: base exercise + `supersetItems` (one or more extra paired exercises). Optional `extraVideos` to attach additional references.
- `DROPSET`: has `dropsetConfig` with `dropPercents` and optional `restSeconds`.
- `CIRCUIT`: part of a circuit; use `circuitGroup` to group items. Circuits typically include 5 exercises with no rest.

Endpoint: `POST /api/v1/plans/training/week/:userId`

Request body:

```json
{
	"startDate": "2025-01-01",
	"days": [
		{
			"dayNumber": 1,
			"items": [
				{
					"itemType": "REGULAR",
					"trainingVideoId": "<uuid>",
					"sets": 4,
					"repeats": 12
				},
				{
					"itemType": "SUPERSET",
					"trainingVideoId": "<uuid-main>",
					"sets": 3,
					"repeats": 10,
					"supersetItems": [
						{ "trainingVideoId": "<uuid-b>", "sets": 3, "repeats": 10 }
					],
					"extraVideos": [ { "trainingVideoId": "<uuid-extra>" } ]
				},
				{
					"itemType": "DROPSET",
					"trainingVideoId": "<uuid>",
					"sets": 1,
					"repeats": 12,
					"dropsetConfig": { "dropPercents": [20, 20, 20], "restSeconds": 0 }
				},
				{
					"itemType": "CIRCUIT",
					"circuitGroup": "A",
					"trainingVideoId": "<uuid-1>",
					"sets": 3,
					"repeats": 15
				}
			]
		}
		/* … provide 7 day templates … */
	]
}
```

Notes:

- `days` must contain exactly 7 entries (1..7). If `dayNumber` is omitted, index is used.
- For `SUPERSET`, at least one `supersetItem` is required. `extraVideos` is optional.
- For `DROPSET`, `dropsetConfig.dropPercents` is required.
- For `CIRCUIT`, group related items using the same `circuitGroup` label (e.g., "A").
- Response returns weeks → days → items including `itemType`, `supersetItems`, `extraVideos`, `dropsetConfig`, and `circuitGroup`.

## ▶️ Quick Start

```powershell
npm install
npm run build
npm run start:dev
```

Ensure Redis is running before starting the dev server.

### Manual Socket Playground

Once the server is running, open [`/socket-test.html`](http://localhost:3000/socket-test.html) in your browser to exercise the Socket.IO APIs, emit chat events, send heartbeats, and call the REST helpers without any additional tooling.

## ✅ Quality Checks

- `npm run build` – TypeScript compilation.
- `npm run lint` – ESLint (optional but recommended).

## 📚 Further Ideas

- Message read receipts per trainer.
- Push notifications for new trainer replies.
- Socket.IO Redis adapter for horizontal scaling.

Happy coding! ✨
