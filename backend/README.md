# NextTask Backend

Go + Echo + GORM + PostgreSQL backend for NextTask.

## Setup

```bash
cp .env.example .env
docker compose up -d
go mod tidy
go run ./cmd/server
```

The API listens on `http://localhost:8080` by default.

## Endpoints

- `GET /health`
- `GET /api/task-groups`
- `POST /api/task-groups`
- `PATCH /api/task-groups/:id`
- `DELETE /api/task-groups/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/export/ics`
