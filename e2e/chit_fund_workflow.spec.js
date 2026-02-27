import { test, expect } from '@playwright/test';

test.describe('Chit Fund Workflow', () => {
    // Unique name and phone for this run to ensure clean aggregation check
    const runId = Date.now().toString().slice(-6);
    const customerName = `E2E Chit ${runId}`;
    const phoneNumber = `99${runId}${runId}`; // Guaranteed 10 digits if runId is 4, but slice(-6) gives 6 so 2+6+6=14? No.
    // Let's just use a simpler unique phone:
    const uniquePhone = '9' + Math.floor(Math.random() * 900000000 + 100000000).toString();

    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[placeholder="name@company.com"]', 'ragusuresh291@gmail.com');
        await page.fill('input[placeholder="Enter your password"]', 'Ragunath@2006');
        await page.click('button:has-text("Secure Login")');
        await expect(page).toHaveURL(/.*dashboard/);
    });

    async function addEntry(page, name, phone, amount, rate) {
        console.log(`Adding entry: ${name}, ${phone}, Rs.${amount}`);
        await page.goto('/admin/chit/new');

        await page.fill('input[placeholder="Enter customer name"]', name);
        await page.fill('input[placeholder="10-digit mobile number"]', phone);
        await page.fill('input[placeholder="Enter amount"]', amount);

        // Wait for rate input and ensure it's not and-bound to loading
        await page.waitForTimeout(1000);
        const rateInput = page.locator('label:has-text("Gold Rate Today") + input');
        await rateInput.fill(rate);
        await rateInput.press('Tab');

        await page.click('button:has-text("Save Entry")');

        // Wait for success toast and redirect
        await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveURL(/.*chit/, { timeout: 15000 });
    }

    test('should aggregate multiple chit entries for a single customer', async ({ page }) => {
        console.log('--- Step 1: Adding Entries ---', customerName, uniquePhone);
        await addEntry(page, customerName, uniquePhone, '1000', '6000');
        await addEntry(page, customerName, uniquePhone, '2000', '6000');

        // 3. Verify Aggregation
        console.log('--- Step 2: Verifying Aggregation ---');
        await page.goto('/admin/chit');
        await page.click('button:has-text("User")');

        const searchInput = page.locator('input[placeholder="Enter customer name or phone number..."]');
        await searchInput.fill(uniquePhone);

        // Results are in cards
        const userCard = page.locator('.bg-gray-50').filter({ hasText: uniquePhone });
        await expect(userCard).toBeVisible({ timeout: 15000 });

        // Total should be 3,000 for this unique phone
        await expect(userCard.getByText('Rs.3,000')).toBeVisible();
    });
});
