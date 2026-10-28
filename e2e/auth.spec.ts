import { test, expect } from '@playwright/test';

test.describe('Authentication and Route Protection Workflows', () => {
  const uniqueId = Date.now();
  const testCustomer = {
    name: `Customer Test ${uniqueId}`,
    email: `customer_${uniqueId}@example.com`,
    password: 'Password12345!',
  };

  test('1. Customer registration and automatic login into dashboard', async ({ page }) => {
    await page.goto('/customer-registration');

    // Verify registration page elements
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    // Fill registration form
    await page.getByLabel('Full name').fill(testCustomer.name);
    await page.getByLabel('Email address').fill(testCustomer.email);
    await page.getByLabel('Password').fill(testCustomer.password);

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Successfully redirects to /customer/dashboard
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);
    await expect(page.getByText('Good morning! Here\'s your overview.')).toBeVisible();
    await expect(page.getByText(testCustomer.name)).toBeVisible();
  });

  test('2. Session persistence after page refresh using HttpOnly cookie', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.getByLabel('Email address').fill(testCustomer.email);
    await page.getByLabel('Password').fill(testCustomer.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/.*\/customer\/dashboard/);
    await expect(page.getByText(testCustomer.name)).toBeVisible();

    // Refresh the page
    await page.reload();

    // Verify session remains active and user stays on dashboard
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);
    await expect(page.getByText(testCustomer.name)).toBeVisible();
  });

  test('3. Logout and access to protected routes', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.getByLabel('Email address').fill(testCustomer.email);
    await page.getByLabel('Password').fill(testCustomer.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);

    // Open user menu and click Sign out
    await page.locator('button').filter({ hasText: testCustomer.name }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();

    // Redirected to login
    await expect(page).toHaveURL(/.*\/login/);

    // Attempting to visit protected customer dashboard redirects to login
    await page.goto('/customer/dashboard');
    await expect(page).toHaveURL(/.*\/login/);

    // Attempting to visit protected ticket creation redirects to login
    await page.goto('/customer/create-ticket');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('13. Unauthorized users receive appropriate access-denied responses', async ({ page }) => {
    // Log in as customer
    await page.goto('/login');
    await page.getByLabel('Email address').fill(testCustomer.email);
    await page.getByLabel('Password').fill(testCustomer.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*\/customer\/dashboard/);

    // Attempt to access admin routes directly
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/.*\/access-denied/);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();

    // Attempt to access agent routes directly
    await page.goto('/agent/queue');
    await expect(page).toHaveURL(/.*\/access-denied/);
  });
});
