# Mela Desk — GitHub Collaboration Guidelines

## 1. Golden Rules
- Never push directly to `main`.
- Create a separate branch for every task.
- Submit changes through a Pull Request (PR).
- Test your code before submitting a PR.

## 2. Clone the Repository (First Time Only)

Copy the repository URL from GitHub, then run:

```bash
git clone https://github.com/Musharraf-Mahad/mela-desk.git
cd mela-desk
```

## 3. Create a Branch

Before starting a task, update `main` and create your own branch:

```bash
git switch main
git pull origin main
git switch -c feature/your-task
```

Branch naming examples:
- `feature/ticket-creation`
- `fix/login-error`
- `docs/update-readme`
- `test/ticket-api`

## 4. Code, Test, Commit, and Push

Make your changes, then test your code. When ready, run:

```bash
git status
git add .
git commit -m "feat: add ticket creation"
git push -u origin feature/your-task
```

Use a meaningful commit message, such as `fix: correct login validation`.

**Note:** Replace `feature/your-task` with your actual branch name.

## 5. Create a Pull Request

1. Open the repository on GitHub.
2. Click **Compare & pull request** (or open a new PR).
3. Set the base branch to `main` and the compare branch to your feature branch.
4. Describe your changes and testing.
5. Request a review from at least one teammate.
6. Address feedback and merge only after approval.

## 6. Before Starting Another Task

After your PR is merged:

```bash
git switch main
git pull origin main
git switch -c feature/next-task
```

## 7. Backend API

The backend uses Node.js, Express, TypeScript, Prisma, and MySQL. From the repository root, install the backend dependencies and configure its environment:

```bash
cd backend
npm install
cp .env.example .env
```

In `backend/.env`, set `DATABASE_URL` to your MySQL connection string, `PORT` to the API port, and `FRONTEND_ORIGINS` to a comma-separated list of trusted frontend origins. For local Vite development, the default frontend origin is `http://localhost:5173`.

For a fresh development database, apply the checked-in migrations and generate the client:

```bash
npm run db:migrate
npm run db:generate
```

For deployment, apply migrations with `npm run db:deploy`. Use `npm run db:migrate` only in development to create migrations. Avoid `db:push` on shared or production databases. If a database was already initialized using `db:push`, reconcile its migration history before using `db:deploy`; do not run the initial migration against tables that already exist.

Run the API, tests, and TypeScript build from the `backend` directory:

```bash
npm run dev
npm test
npm run build
```

### Current API routes

All authenticated routes use the `mela_desk_session` HttpOnly cookie issued by `POST /api/auth/login`.

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/auth/register` | Public customer registration |
| `POST` | `/api/auth/login` | Public login |
| `GET` | `/api/auth/me` | Authenticated user |
| `POST` | `/api/auth/logout` | Revokes the session cookie if present |
| `PATCH` | `/api/auth/profile` | Authenticated user; updates own display name |
| `POST` | `/api/auth/change-password` | Authenticated user |
| `POST` | `/api/tickets` | Customer |
| `GET` | `/api/tickets` | Role-scoped tickets; supports status/category/priority filters and subject/description search |
| `GET` | `/api/tickets/:ticketId` | Ticket owner, assigned agent, or admin |
| `POST` | `/api/tickets/:ticketId/comments` | Ticket owner, assigned agent, or admin |
| `PATCH` | `/api/tickets/:ticketId/status` | Assigned agent or admin |
| `PATCH` | `/api/tickets/:ticketId/assignee` | Admin |
| `POST` | `/api/tickets/:ticketId/claim` | Agent; open unassigned tickets only |
| `GET` | `/api/users/agents` | Admin |
| `PATCH` | `/api/users/:userId/status` | Admin |
| `GET` | `/api/audit-logs` | Admin; filterable by ticket, user, and action |
| `GET` | `/api/health` | Public; reports API/database health |

Customer ticket responses omit internal comments. Ticket status, assignment, account status, creation, and comment changes are recorded in the audit log.

API errors use JSON responses with `success: false` and a safe message. Malformed JSON returns `400`, oversized request bodies return `413`, unknown routes return `404`, and unexpected server errors return a generic `500` message.
