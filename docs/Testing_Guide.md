# MelaDesk – Testing Guide

## 1. Introduction

MelaDesk is a web-based customer support ticket management system. This guide helps mentors and testers install, access, and evaluate the application's main features.

## 2. Requirements

Before testing, make sure you have:

- Git
- Docker Desktop
- Docker Compose
- An internet connection for the initial setup

## 3. Running the Application

Clone the project repository:

```bash
git clone https://github.com/Musharraf-Mahad/mela-desk.git
cd mela-desk
```

Start the application:

```bash
docker compose up -d --build
```

Check the running containers:

```bash
docker compose ps
```

Access the application:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health check | http://localhost:5173/api/health |

The MySQL database runs inside Docker.

**Note:** Follow the project's administrator setup instructions to create the initial administrator account. Use the credentials provided separately by the project team.

## 4. User Roles and Testing

MelaDesk has three main user roles.

### 4.1 Customer

Test the following features:

- Register a new customer account.
- Log in and log out.
- View the customer dashboard.
- Create a support ticket.
- Select a ticket category and priority.
- View personal tickets.
- Open ticket details.
- Add comments to tickets.
- Update profile information.

### 4.2 Support Agent

Test the following features:

- Log in as a support agent.
- View the support dashboard.
- View the ticket queue.
- Claim an available ticket.
- View assigned tickets.
- Open ticket details.
- Update ticket status.
- Add public comments.
- Add internal notes.

### 4.3 Administrator

Test the following features:

- Log in as an administrator.
- View the administrator dashboard.
- View and manage users.
- Manage support agents.
- View and manage tickets.
- Assign tickets to agents.
- View reports and analytics.
- Access audit logs.
- Manage system settings and ticket categories.

## 5. Security Testing

Verify the following:

- Unauthenticated users cannot access protected pages.
- Customers cannot access administrator pages.
- Customers can only access their own tickets.
- Agents cannot perform administrator-only actions.
- Unauthorized API requests are rejected.
- Login and logout work correctly.

## 6. Additional Testing

Check the following application features:

- English and Amharic language switching.
- Responsive layout on desktop and mobile screens.
- Ticket status changes.
- Ticket comments and notifications.
- Data persistence after restarting Docker containers.

To restart the application:

```bash
docker compose restart
```

## 7. Testing Checklist

| No. | Test scenario | Expected result |
|---|---|---|
| 1 | Customer registration | Account is created successfully |
| 2 | User login | User accesses the correct dashboard |
| 3 | Ticket creation | Ticket is created with a unique ID |
| 4 | Ticket assignment | Ticket is assigned to the selected agent |
| 5 | Ticket status update | New status is saved |
| 6 | Ticket comments | Comments are displayed correctly |
| 7 | User management | Administrator can manage users |
| 8 | Access control | Unauthorized access is rejected |
| 9 | Language switching | Selected language is displayed |
| 10 | Data persistence | Data remains after container restart |

## 8. Stopping the Application

To stop the application:

```bash
docker compose down
```

**Important:** Do not use `docker compose down -v` during normal testing because it removes the database volume and can delete stored test data.

## 9. Reporting Issues

If a tester discovers a problem, they should record:

- Issue title
- Steps to reproduce
- Expected result
- Actual result
- Screenshot, if available
- Severity (Low, Medium, or High)

Report identified issues to the MelaDesk development team.

## 10. Conclusion

This guide provides the basic steps for testing MelaDesk, including installation, role-based functionality, security, and additional application features. Testers should complete the relevant scenarios and report any issues before final evaluation.