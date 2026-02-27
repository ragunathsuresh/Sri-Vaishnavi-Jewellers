import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should login successfully', async ({ page }) => {
        // Go to login page
        await page.goto('/login');

        // Fill login form
        // Note: Assuming IDs or labels based on common patterns in the app
        // Fill login form
        await page.fill('input[placeholder="name@company.com"]', 'ragusuresh291@gmail.com');
        await page.fill('input[placeholder="Enter your password"]', 'Ragunath@2006');
        await page.click('button:has-text("Secure Login")');

        // Wait for navigation to dashboard
        await expect(page).toHaveURL(/.*dashboard/);
        await expect(page.getByText('Dashboard Overview')).toBeVisible();
    });

    test('should show error on wrong credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpass');
        await page.click('button[type="submit"]');

        // Check for error message (Assuming toast or alert)
        // await expect(page.getByText(/Invalid credentials/i)).toBeVisible();
    });
});
