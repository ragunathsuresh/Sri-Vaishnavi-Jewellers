import { test, expect } from '@playwright/test';

test.describe('Expense -> Billing Summary Workflow', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[placeholder="name@company.com"]', 'ragusuresh291@gmail.com');
        await page.fill('input[placeholder="Enter your password"]', 'Ragunath@2006');
        await page.click('button:has-text("Secure Login")');
        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should update billing summary total when a new expense is added', async ({ page }) => {
        // 1. Get initial total from billing summary
        await page.goto('/admin/billing');

        // The total for Daily Expenses is in Section 5 table footer
        const expenseTotalLocator = page.locator('section:has-text("Daily Expenses") tfoot td:nth-child(2)');
        const initialText = await expenseTotalLocator.innerText();
        const initialTotal = parseFloat(initialText.replace(/[^0-9.]/g, '')) || 0;

        // 2. Add a new expense
        const expenseName = `E2E Fuel ${Date.now()}`;
        await page.goto('/admin/expenses');
        await page.click('button:has-text("Add New Expense")');

        await page.fill('input[placeholder="Enter expense name"]', expenseName);
        await page.fill('input[placeholder="0.00"]', '500');

        await page.click('form button:has-text("Add New Expense")');

        // Wait for the total to update in ExpensePage list
        await expect(page.getByText(expenseName)).toBeVisible({ timeout: 10000 });

        // 3. Verify Billing Summary update
        await page.goto('/admin/billing');
        const newText = await expenseTotalLocator.innerText();
        const newTotal = parseFloat(newText.replace(/[^0-9.]/g, '')) || 0;

        expect(newTotal).toBe(initialTotal + 500);
    });
});
