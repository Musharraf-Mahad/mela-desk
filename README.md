# MelaDesk — Customer Support Ticket Management System

MelaDesk is a web-based customer support ticket management system that helps organizations manage customer inquiries, service requests, and technical issues efficiently.

It provides a centralized platform where customers can submit and track tickets, support agents can manage and resolve requests, and administrators can oversee users and system activities.

## Key Features

- Secure user registration and authentication.
- Role-based access control.
- Customer ticket creation and tracking.
- Ticket assignment and priority management.
- Ticket status updates and comments.
- Support agent dashboard and ticket queue.
- Administrator dashboard and user management.
- Internal notes for support agents.
- Live ticket updates.
- Email notifications.
- English and Amharic language support.
- Responsive user interface.
- Activity monitoring through audit logs.

## User Roles

| Role | Responsibilities |
|---|---|
| Customer | Create tickets, track progress, and communicate with support agents. |
| Support Agent | Manage assigned tickets, claim available tickets, and resolve customer issues. |
| Administrator | Manage users, assign tickets, and monitor system activities. |

## Technology Stack

**Frontend**
- React
- TypeScript
- Tailwind CSS
- Vite
- Axios
- React Router

**Backend**
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- Zod

**Database**
- MySQL 8.4

**Tools and Infrastructure**
- Docker and Docker Compose
- Nginx
- Vitest
- Playwright
- Git and GitHub

## System Architecture

MelaDesk follows a frontend-backend architecture.

```text
        CUSTOMER / AGENT / ADMIN
                   |
                   v
            REACT FRONTEND
                   |
                   v
                 NGINX
                   |
                   v
             EXPRESS API
                   |
                   v
               PRISMA
                   |
                   v
                MYSQL
```

The frontend communicates with the backend through REST APIs. The backend handles authentication, authorization, business logic, and database operations.

## Project Structure

```text
mela-desk/
│
├── backend/
│   ├── prisma/
│   ├── scripts/
│   ├── src/
│   ├── tests/
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
│
├── docs/
├── e2e/
├── docker-compose.yml
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js 22 or later
- npm
- MySQL 8.4
- Git
- Docker Desktop (for containerized deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/Musharraf-Mahad/mela-desk.git
cd mela-desk
```

### 2. Install Dependencies

```bash
npm install
cd backend
npm install
cd ../frontend
npm install
```

### 3. Run the Application Locally

Start the backend from the `backend` directory:

```bash
npm run dev
```

Start the frontend from the `frontend` directory in another terminal:

```bash
npm run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

Configure your local MySQL connection and apply the Prisma migrations before starting the backend.

## Running with Docker

MelaDesk supports Docker Compose for running the frontend, backend, and MySQL database together.

### Build and Start

From the project root:

```bash
docker compose up -d --build
```

### Check Running Containers

```bash
docker compose ps
```

### View Application Logs

```bash
docker compose logs -f
```

### Stop the Application

```bash
docker compose down
```

**Application access:**

| Service | Address |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | Internal Docker port 5000 |
| MySQL | localhost:3307 |

Docker Compose uses a persistent volume for MySQL data. Avoid `docker compose down -v` unless you intentionally want to delete the database volume.

## Database Management

MelaDesk uses MySQL with Prisma ORM.

The Prisma schema is located at:

`backend/prisma/schema.prisma`

Useful database commands (run inside `backend`):

| Command | Purpose |
|---|---|
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply development migrations |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:studio` | Open Prisma Studio |

## Testing

The project includes backend tests, frontend quality checks, and end-to-end tests.

Run backend tests:

```bash
npm run test:backend
```

Build and type-check the frontend:

```bash
npm run test:frontend
```

Run frontend linting:

```bash
npm run lint:frontend
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## API Documentation

The backend provides REST API endpoints for:

- Authentication and account management.
- Ticket creation and management.
- Ticket assignment and status updates.
- Comments and internal notes.
- User and agent management.
- Audit logs.
- Application health checks.

For detailed API routes, permissions, and integration guidelines, see:

[Backend Integration Contract](./docs/backend-integration-contract.md)

## Security

MelaDesk includes:

- Argon2id password hashing.
- HttpOnly session cookies.
- Role-based authorization.
- Server-side input validation.
- Ticket ownership and permission checks.
- Protected administrator operations.
- Audit logging.
- Secure environment-based configuration.

## Languages

The application supports:

- English
- Amharic

## Project Information

| Detail | Description |
|---|---|
| Project | MelaDesk |
| Type | Customer Support Ticket Management System |
| Frontend | React + TypeScript |
| Backend | Node.js + Express |
| Database | MySQL |
| ORM | Prisma |
| Deployment | Docker Compose |

---

**MelaDesk — Making Customer Support Organized, Trackable, and Efficient.**
