import { test, expect } from '@playwright/test';

test.describe('Administrator Oversight and Agent Management', () => {
  const ts = Date.now();
  const adminCredentials = {
    email: 'admin@meladesk.internal',
    password: 'AdminPassword123!',
  };

  const newAgent = {
    name: `Agent Rachel ${ts}`,
    email: `rachel_${ts}@example.com`,
    initialPassword: 'TempPassword123!',
    resetPassword: 'NewPassword999!',
  };

  test('12. Administrator login, agent creation, password reset, and status update', async ({ page }) => {
    // 1. Admin login
    await page.goto('/login');
    await page.getByLabel('Email address').fill(adminCredentials.email);
    await page.getByLabel('Password').fill(adminCredentials.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify redirected to /admin/dashboard
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);
    await expect(page.getByText('Good morning! Here\'s your overview.')).toBeVisible();

    // 2. Navigate to User & Agent Management
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Support Agent Management' })).toBeVisible();

    // Click Create Agent button
    await page.getByRole('button', { name: 'Create Agent' }).click();
    await expect(page.getByText('Create Support Agent Account')).toBeVisible();

    // Fill Create Agent form
    await page.getByLabel('Agent Full Name').fill(newAgent.name);
    await page.getByLabel('Agent Email Address').fill(newAgent.email);
    await page.getByLabel('Temporary Password').fill(newAgent.initialPassword);

    await page.getByRole('button', { name: 'Create Agent', exact: true }).click();
    await expect(page.getByText(/created successfully/i)).toBeVisible();

    // Verify new agent appears in the list
    await expect(page.getByText(newAgent.name)).toBeVisible();
    await expect(page.getByText(newAgent.email)).toBeVisible();

    // 3. Reset Agent Password
    const agentRow = page.locator('tr').filter({ hasText: newAgent.email });
    await agentRow.getByRole('button', { name: 'Reset Password' }).click();

    await expect(page.getByText(`Reset Password for ${newAgent.name}`)).toBeVisible();
    await page.getByLabel('New Password').fill(newAgent.resetPassword);
    await page.getByRole('button', { name: 'Reset Password', exact: true }).click();

    await expect(page.getByText(/password reset/i)).toBeVisible();

    // 4. Test login with the newly created and reset agent credentials
    // Sign out admin
    await page.locator('button').filter({ hasText: 'Admin User' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/.*\/login/);

    // Sign in as new agent with reset password
    await page.getByLabel('Email address').fill(newAgent.email);
    await page.getByLabel('Password').fill(newAgent.resetPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Successful login -> agent dashboard
    await expect(page).toHaveURL(/.*\/agent\/dashboard/);
    await expect(page.getByText(newAgent.name)).toBeVisible();
  });
});
