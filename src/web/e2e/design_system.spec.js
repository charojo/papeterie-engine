import { test, expect } from '@playwright/test';

test.describe('Design System Integration', () => {
    test('should open design system from settings and show components', async ({ page }) => {
        // 1. Visit App
        await page.goto('http://localhost:5173');

        // 2. Handle Login (Enter Local Theater)
        const loginButton = page.getByRole('button', { name: 'Enter Local Theater' });
        if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await loginButton.click();
        }

        // 3. Wait for App to load
        await page.waitForSelector('.app-container', { timeout: 10000 });

        // 4. Open Settings Menu
        await page.click('button[title="Settings"]');

        // 5. Click Design System
        await page.click('button[title="View visual components and design standards"]');

        // 6. Verify Design System header
        await expect(page.locator('h1')).toContainText('Papeterie Design System');

        // 7. Verify Button categories
        await expect(page.locator('h2')).toContainText(['Buttons', 'Iconography', 'Form System', 'Theme Palette']);

        // 8. Capture Screenshot
        await page.screenshot({ path: 'test-results/design-system-verification.png', fullPage: true });
        console.log('Design System verification screenshot saved to test-results/design-system-verification.png');
    });
});
