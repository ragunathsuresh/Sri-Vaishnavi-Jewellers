import { test, expect } from '@playwright/test';

test.describe('Full Sales Workflow', () => {
    const serialNo = `E2E-${Date.now()}`;

    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[placeholder="name@company.com"]', 'ragusuresh291@gmail.com');
        await page.fill('input[placeholder="Enter your password"]', 'Ragunath@2006');
        await page.click('button:has-text("Secure Login")');
        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should complete a full stock-to-sale cycle', async ({ page }) => {
        // 1. Add Stock
        console.log('--- Step 1: Adding Stock ---', serialNo);
        await page.goto('/admin/stock/new');
        await page.fill('input[name="itemCode"]', serialNo);
        await page.press('input[name="itemCode"]', 'Tab');
        await page.waitForTimeout(1000);

        await page.fill('input[name="itemName"]', 'E2E Test Ring');
        await page.selectOption('select[name="jewelleryType"]', 'Gold');
        await page.selectOption('select[name="category"]', 'Ring');
        await page.fill('input[name="grossWeight"]', '10.500');
        await page.fill('input[name="netWeight"]', '10.000');
        await page.fill('input[name="newQuantity"]', '5');

        await page.click('button:has-text("Save Stock Item")');
        // Actual notification: Stock saved in "Stock management page"
        await expect(page.getByText(/Stock saved/i)).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveURL(/.*stock/, { timeout: 15000 });

        // 2. Create Sale
        console.log('--- Step 2: Creating Sale ---');
        await page.goto('/admin/sales');
        await page.fill('input[placeholder="Type name..."]', 'E2E Customer');
        await page.fill('input[placeholder="Ph: +91..."]', '9988776655');

        await page.fill('input[placeholder="Enter item no"]', serialNo);
        await page.press('input[placeholder="Enter item no"]', 'Enter');

        // Wait for item to be found and populated
        await expect(page.locator('input[value="E2E Test Ring"]').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("ADD TO ISSUE DRAFT")');
        await expect(page.getByText(/READY/i)).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("SAVE TRANSACTION PERMANENTLY")');
        await expect(page).toHaveURL(/.*transactions/, { timeout: 15000 });

        // 3. Verify Billing Summary
        console.log('--- Step 3: Verifying Billing Summary ---');
        await page.goto('/admin/billing');
        const salesSection = page.locator('section:has-text("1. Customer Sales Table")');
        await expect(salesSection.getByText('E2E Customer').first()).toBeVisible({ timeout: 15000 });
    });
});
