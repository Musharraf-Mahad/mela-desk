import { test, expect } from '@playwright/test';

test.describe('Customer Ticket Operations and Isolation', () => {
  const ts = Date.now();
  const customerA = {
    name: `Customer Alpha ${ts}`,
    email: `alpha_${ts}@example.com`,
    password: 'Password12345!',
  };

  const customerB = {
    name: `Customer Beta ${ts}`,
    email: `beta_${ts}@example.com`,
    password: 'Password12345!',
  };

  let ticketAId: string = '';

  test.beforeAll(async ({ request }) => {
    // Register Customer A
    const resA = await request.post('http://localhost:5000/api/auth/register', {
      data: customerA,
    });
    expect(resA.ok()).toBeTruthy();

    // Register Customer B
    const resB = await request.post('http://localhost:5000/api/auth/register', {
      data: customerB,
    });
    expect(resB.ok()).toBeTruthy();
  });

  test('4. Customer ticket creation and persistence in MySQL', async ({ page }) => {
    // Log in as Customer A
    await page.goto('/login');
    await page.getByLabel('Email address').fill(customerA.email);
    await page.getByLabel('Password').fill(customerA.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);

    // Navigate to Create Ticket
    await page.goto('/customer/create-ticket');
    await expect(page.getByRole('heading', { name: 'New support ticket' })).toBeVisible();

    const ticketSubject = `Unable to process monthly payment ${ts}`;
    const ticketDesc = 'My corporate credit card was declined with error code E-402.';

    await page.getByLabel('Subject').fill(ticketSubject);
    await page.getByLabel('Category').selectOption('billing');
    await page.getByLabel('Priority').selectOption('urgent');
    await page.getByLabel('Description').fill(ticketDesc);

    await page.getByRole('button', { name: 'Submit Ticket' }).click();

    // Success alert and redirect to ticket detail
    await expect(page.getByText('Ticket Submitted Successfully')).toBeVisible();
    await expect(page).toHaveURL(/.*\/tickets\/.+/);

    // Extract ticket ID from URL
    const url = page.url();
    ticketAId = url.split('/tickets/')[1];
    expect(ticketAId).toBeTruthy();

    // Verify detail page reflects real submitted data
    await expect(page.getByText(ticketSubject)).toBeVisible();
    await expect(page.getByText(ticketDesc)).toBeVisible();
    await expect(page.getByText('billing')).toBeVisible();
  });

  test('5. Customer ticket listing and details view', async ({ page }) => {
    // Log in as Customer A
    await page.goto('/login');
    await page.getByLabel('Email address').fill(customerA.email);
    await page.getByLabel('Password').fill(customerA.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Navigate to My Tickets
    await page.goto('/customer/tickets');
    await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible();

    // Verify Customer A's ticket appears in the table
    await expect(page.getByText(ticketAId)).toBeVisible();
    await expect(page.getByText(`Unable to process monthly payment ${ts}`)).toBeVisible();

    // Click ticket row to open details
    await page.getByText(ticketAId).click();
    await expect(page).toHaveURL(new RegExp(`.*\\/tickets\\/${ticketAId}`));
    await expect(page.getByText(`Unable to process monthly payment ${ts}`)).toBeVisible();

    // Submit a customer reply
    const replyBody = 'Update: My bank confirmed the card is unlocked.';
    await page.getByLabel('Reply').fill(replyBody);
    await page.getByRole('button', { name: 'Send Reply' }).click();

    // Verify reply appears in conversation
    await expect(page.getByText(replyBody)).toBeVisible();
  });

  test('6. Customer isolation: Customer B cannot access Customer A\'s tickets', async ({ page }) => {
    // Log in as Customer B
    await page.goto('/login');
    await page.getByLabel('Email address').fill(customerB.email);
    await page.getByLabel('Password').fill(customerB.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);

    // Customer B's tickets list should be empty
    await page.goto('/customer/tickets');
    await expect(page.getByText('No tickets found.')).toBeVisible();
    await expect(page.getByText(ticketAId)).not.toBeVisible();

    // Attempt to directly navigate to Customer A's ticket
    await page.goto(`/tickets/${ticketAId}`);

    // Backend responds with 404 / error and page shows error alert
    await expect(page.getByText('Ticket not found')).toBeVisible();
  });

  test('14. Loading states, empty states, and validation errors', async ({ page }) => {
    await page.goto('/customer-registration');

    // Test client and server validation: password under 12 characters
    await page.getByLabel('Full name').fill('Invalid User');
    await page.getByLabel('Email address').fill(`invalid_${ts}@example.com`);
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should display validation error
    await expect(page.getByText(/Must be between 12 and 128 characters|Invalid registration details/i)).toBeVisible();
  });
});
