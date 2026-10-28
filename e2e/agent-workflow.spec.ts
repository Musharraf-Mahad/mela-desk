import { test, expect } from '@playwright/test';

test.describe('Agent Support Queue, Claiming, Notes and Customer Visibility', () => {
  const ts = Date.now();

  const customer = {
    name: `Customer Gamma ${ts}`,
    email: `gamma_${ts}@example.com`,
    password: 'Password12345!',
  };

  const agent = {
    name: `Agent Dave ${ts}`,
    email: `dave_agent_${ts}@example.com`,
    password: 'AgentPassword123!',
  };

  const adminCredentials = {
    email: 'admin@meladesk.internal',
    password: 'AdminPassword123!',
  };

  let ticketId: string = '';

  test.beforeAll(async ({ request }) => {
    // 1. Admin login to create an agent account
    const adminLoginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: adminCredentials,
    });
    expect(adminLoginRes.ok()).toBeTruthy();
    const adminCookie = adminLoginRes.headers()['set-cookie'];

    // 2. Create the Agent Dave account via POST /api/users/agents
    const createAgentRes = await request.post('http://localhost:5000/api/users/agents', {
      headers: { cookie: adminCookie },
      data: agent,
    });
    expect(createAgentRes.ok()).toBeTruthy();

    // 3. Register customer Gamma
    const registerCustRes = await request.post('http://localhost:5000/api/auth/register', {
      data: customer,
    });
    expect(registerCustRes.ok()).toBeTruthy();

    // 4. Log in as Customer Gamma to create an open unassigned ticket
    const custLoginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: customer.email, password: customer.password },
    });
    expect(custLoginRes.ok()).toBeTruthy();
    const custCookie = custLoginRes.headers()['set-cookie'];

    const createTicketRes = await request.post('http://localhost:5000/api/tickets', {
      headers: { cookie: custCookie },
      data: {
        subject: `Agent Workflow Ticket ${ts}`,
        description: 'Customer needs technical assistance with network connectivity.',
        category: 'technical',
        priority: 'high',
      },
    });
    expect(createTicketRes.ok()).toBeTruthy();
    const ticketPayload = await createTicketRes.json();
    ticketId = ticketPayload.data.ticket.id;
    expect(ticketId).toBeTruthy();
  });

  test('7. Agent login and viewing the real support queue', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(agent.email);
    await page.getByLabel('Password').fill(agent.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Role-based redirect to agent dashboard
    await expect(page).toHaveURL(/.*\/agent\/dashboard/);
    await expect(page.getByText(agent.name)).toBeVisible();

    // Navigate to Support Queue
    await page.goto('/agent/queue');
    await expect(page.getByRole('heading', { name: 'Support Queue' })).toBeVisible();

    // Verify unassigned ticket is visible in the queue
    await expect(page.getByText(ticketId)).toBeVisible();
    await expect(page.getByText(`Agent Workflow Ticket ${ts}`)).toBeVisible();
  });

  test('8. Agent claiming open unassigned ticket', async ({ page }) => {
    // Log in as Agent Dave
    await page.goto('/login');
    await page.getByLabel('Email address').fill(agent.email);
    await page.getByLabel('Password').fill(agent.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.goto('/agent/queue');
    await expect(page.getByText(ticketId)).toBeVisible();

    // Click ticket row to open workspace
    await page.getByText(ticketId).click();
    await expect(page).toHaveURL(new RegExp(`.*\\/agent\\/tickets\\/${ticketId}`));

    // Claim the ticket using Claim Ticket button
    const claimButton = page.getByRole('button', { name: 'Claim Ticket' });
    await expect(claimButton).toBeVisible();
    await claimButton.click();

    await expect(page.getByText(/Ticket claimed successfully/i)).toBeVisible();

    // Verify ticket assignee shows Agent Dave
    await expect(page.getByText(agent.name)).toBeVisible();
  });

  test('9. Agent status updates through the backend', async ({ page }) => {
    // Log in as Agent Dave
    await page.goto('/login');
    await page.getByLabel('Email address').fill(agent.email);
    await page.getByLabel('Password').fill(agent.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.goto(`/agent/tickets/${ticketId}`);

    // Update status to In Progress
    await page.getByLabel('Update Status').selectOption('in_progress');
    await expect(page.getByText(/Status updated to in progress/i)).toBeVisible();

    // Update status to Resolved
    await page.getByLabel('Update Status').selectOption('resolved');
    await expect(page.getByText(/Status updated to resolved/i)).toBeVisible();
  });

  test('10. Public replies and internal notes creation', async ({ page }) => {
    // Log in as Agent Dave
    await page.goto('/login');
    await page.getByLabel('Email address').fill(agent.email);
    await page.getByLabel('Password').fill(agent.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.goto(`/agent/tickets/${ticketId}`);

    // Post a public reply
    const publicReplyText = `Public reply from support agent: Issue has been resolved for ticket ${ts}.`;
    await page.getByLabel('Public Reply').fill(publicReplyText);
    await page.getByRole('button', { name: 'Send Reply' }).click();
    await expect(page.getByText('Public reply sent to customer.')).toBeVisible();
    await expect(page.getByText(publicReplyText)).toBeVisible();

    // Post an internal note
    const internalNoteText = `SECRET_INTERNAL_NOTE_${ts}: Routing loop was identified on edge switch 4.`;
    await page.getByLabel('Private internal note').fill(internalNoteText);
    await page.getByRole('button', { name: 'Add Internal Note' }).click();
    await expect(page.getByText('Internal note added (hidden from customer).')).toBeVisible();

    // Verify agent can see both the public reply and the private internal note badge
    await expect(page.getByText(internalNoteText)).toBeVisible();
    await expect(page.getByText('Private Internal Note')).toBeVisible();
  });

  test('11. Customer isolation: Customers cannot see internal notes', async ({ page }) => {
    // Log in as Customer Gamma
    await page.goto('/login');
    await page.getByLabel('Email address').fill(customer.email);
    await page.getByLabel('Password').fill(customer.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);

    // Open ticket details
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByText(`Agent Workflow Ticket ${ts}`)).toBeVisible();

    // Customer CAN see public reply
    await expect(
      page.getByText(`Public reply from support agent: Issue has been resolved for ticket ${ts}.`)
    ).toBeVisible();

    // Customer CANNOT see private internal note
    const internalNoteSnippet = `SECRET_INTERNAL_NOTE_${ts}`;
    await expect(page.getByText(internalNoteSnippet)).not.toBeVisible();
    await expect(page.getByText('Private Internal Note')).not.toBeVisible();
  });
});
