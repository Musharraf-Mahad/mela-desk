# Backend integration contract

This document is the coordination reference for frontend and database contributors. The API is the boundary between the frontend and MySQL: frontend code must use the documented HTTP routes and must not connect to or query the database directly.

## Roles and ticket access

All roles use the same login flow. `POST /api/auth/login` issues the HttpOnly `mela_desk_session` cookie; send it with subsequent requests (`credentials: 'include'` in browser fetch).

### Live ticket updates

Authenticated clients can subscribe to `GET /api/events` using Server-Sent Events. The server sends named `ticket` events whose JSON `data` contains a `type` and `ticketId`, with event-specific fields when applicable. In browsers, use `new EventSource('http://localhost:5000/api/events', { withCredentials: true })`; the existing HttpOnly session cookie authenticates the connection.

```ts
const stream = new EventSource(`${apiBase}/api/events`, { withCredentials: true })
stream.addEventListener('ticket', (event) => {
  const update = JSON.parse((event as MessageEvent<string>).data)
  // Refetch the ticket/list or merge the authorized update into the view.
})
```

Event types include `ticket.created`, `ticket.assigned`, `ticket.unassigned`, `ticket.claimed`, `ticket.status_changed`, `ticket.comment_added`, and `ticket.internal_comment_added`. Events go only to the customer and assigned staff involved; newly created unassigned tickets are announced to active agents. Internal-comment events are staff-only. Reconnects do not replay missed events, so clients should reload their authorized data when a stream reconnects. Live events are held in process memory; multi-instance deployments need a shared event broker.

### Email notifications

Ticket assignment/claim, status changes, and public comments trigger email notifications when SMTP is configured. Internal notes are never emailed. Email delivery is best-effort and does not roll back a successful ticket update; configuration or delivery failures are logged by the API.

Configure these values in `backend/.env` (do not commit secrets):

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=support@example.com
```

Use the SMTP host, port, TLS mode, credentials, and verified sender address issued by your email provider. For local development without a provider, leave `SMTP_HOST` and `SMTP_FROM` empty; email sends are disabled while API operations and live events continue to work. Use a provider sandbox/test inbox before enabling real customer emails.

| Role | Ticket list | Ticket detail/comments | Ticket actions |
|---|---|---|---|
| Customer | Own tickets only | Own tickets; internal comments are hidden | Create tickets and add public comments |
| Agent | Assigned tickets only | Assigned tickets | Claim open unassigned tickets; update assigned ticket status; add public or internal comments |
| Admin | All tickets | Any ticket | Assign/unassign tickets, update status, add public or internal comments, and access audit logs |

An agent claim and an admin assignment are separate operations:

- Agents claim an open, unassigned ticket with `POST /api/tickets/:ticketId/claim`.
- Admins assign or unassign a ticket with `PATCH /api/tickets/:ticketId/assignee`.
- Assigning an agent does not change the ticket status.
- The selected assignee must be an active agent. A ticket can be unassigned by setting `assigneeId` to `null`.
- Successful assignment changes are written to the audit log as `ticket.assigned` or `ticket.unassigned`.

## HTTP conventions

- API prefix: `/api`.
- Authenticated endpoints require the session cookie.
- JSON request bodies use `Content-Type: application/json`.
- Successful responses use `{ "success": true, "data": ... }` where the route returns data.
- Errors use `{ "success": false, "message": "..." }`; validation errors can also contain an `errors` array.
- Common status codes: `400` invalid input, `401` no valid session, `403` insufficient role, `404` resource unavailable to that user, `409` conflicting or no-longer-available operation, `422` invalid active-agent assignment, and `500` unexpected server failure.
- List endpoints return pagination metadata. Default `pageSize` is 20 and maximum is 100.

## Endpoint reference

### Authentication and account

| Method | Route | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create a customer account |
| `POST` | `/api/auth/login` | Public | Sign in and set the session cookie |
| `GET` | `/api/auth/me` | Session | Return the signed-in user |
| `POST` | `/api/auth/logout` | Public/session | Revoke the current session when present |
| `PATCH` | `/api/auth/profile` | Session | Update the caller's display name |
| `POST` | `/api/auth/change-password` | Session | Change the caller's password and revoke sessions |
| `GET` | `/api/events` | Session | Subscribe to role-scoped live ticket events over SSE |

Passwords must be 12–128 characters. Public registration always creates a customer; clients cannot choose a role.

### Tickets

| Method | Route | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/tickets` | Customer | Create a ticket owned by the signed-in customer |
| `GET` | `/api/tickets` | Session | List tickets scoped to the caller's role; supports `status`, `category`, `priority`, `search`, `page`, and `pageSize` |
| `GET` | `/api/tickets/queue` | Agent | List open unassigned tickets; supports `category`, `priority`, `search`, `page`, and `pageSize` |
| `GET` | `/api/tickets/:ticketId` | Owner, assigned agent, admin | Load ticket detail and comments |
| `POST` | `/api/tickets/:ticketId/comments` | Owner, assigned agent, admin | Add a comment |
| `PATCH` | `/api/tickets/:ticketId/status` | Assigned agent, admin | Change ticket status |
| `PATCH` | `/api/tickets/:ticketId/assignee` | Admin | Assign an active agent or unassign |
| `POST` | `/api/tickets/:ticketId/claim` | Agent | Claim an open unassigned ticket |

Ticket creation body:

```json
{
  "subject": "Unable to access my account",
  "description": "The password reset link is not working.",
  "category": "account",
  "priority": "normal"
}
```

Allowed categories: `billing`, `account`, `technical`, `orders`, `general`.

Allowed priorities: `low`, `normal`, `high`, `urgent`.

Allowed statuses: `open`, `in_progress`, `pending`, `resolved`, `closed`.

Admin assignment body:

```json
{ "assigneeId": "agent-user-id" }
```

To unassign:

```json
{ "assigneeId": null }
```

The endpoint returns the updated ticket under `data.ticket`. The active agent directory is available to admins at `GET /api/users/agents`; use its agent `id` as `assigneeId`, not the email or display name.

### Admin user and oversight operations

| Method | Route | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/users/agents` | Admin | Create an active agent |
| `GET` | `/api/users/agents` | Admin | List active agents |
| `PATCH` | `/api/users/agents/:agentId/password` | Admin | Reset an agent password and revoke that agent's sessions |
| `PATCH` | `/api/users/:userId/status` | Admin | Activate/deactivate an account |
| `GET` | `/api/audit-logs` | Admin | List audit records; supports `ticketId`, `userId`, `action`, `page`, and `pageSize` |

The initial admin is created by the backend bootstrap command. Public signup does not grant admin access, and there is no general role-change endpoint.

## Database ownership and safe schema changes

- Prisma is the source of truth for the relational model: `backend/prisma/schema.prisma`.
- Checked-in SQL migrations in `backend/prisma/migrations/` define the deployed schema history.
- Do not make application changes that rely on a manual-only database edit or on `prisma db push` against a shared database.
- For a schema change, coordinate the API behavior and migration before frontend integration. Update the Prisma schema and generate a migration with `npm run db:migrate` in development; review and commit both the schema and generated migration together.
- For deployment or an existing shared environment, apply committed migrations with `npm run db:deploy`. Never rewrite an already-applied migration. If a database was initialized with `db push`, reconcile migration history before using deployment migrations.
- Keep changes additive when possible so old and new application versions can overlap during deployment. If a change is incompatible, coordinate deployment order and data backfill with the team before merging.
- The frontend must use API fields and identifiers rather than assuming database column names or writing directly to MySQL.

Core data ownership:

- `User` owns customer tickets and may be the assignee of tickets.
- `Ticket` references a customer, optional agent assignee, category, priority, and status.
- `Comment` belongs to a ticket and author; `isInternal` controls visibility to customers.
- `AuditLog` records important user and ticket actions and may reference a ticket and actor.
- `Session` stores a hash of the session token, its user, and expiration; raw session tokens are only sent in the HttpOnly cookie.

## Contributor handoff checklist

Before frontend or database work is merged:

1. Agree on the endpoint, request/response fields, role access, and error behavior here or in the relevant PR.
2. Keep frontend types aligned with API response shapes; do not infer server permissions from hidden controls.
3. If persistence changes, include and review a Prisma migration with the backend change.
4. Run `npm test` and `npm run build` in `backend`; run frontend lint/build for frontend changes.
5. Test role restrictions and ownership boundaries, not only the successful request.
