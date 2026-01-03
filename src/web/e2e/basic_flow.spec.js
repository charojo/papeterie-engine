
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

test.describe('Basic Flow', () => {
    test('should load the dashboard and open a scene', async ({ page }) => {
        // 1. Navigate to dashboard
        await page.goto('/');

        // Check that the title is correct or some element exists
        await expect(page).toHaveTitle(/Papeterie Engine/);

        // 1.5 Handle Login (if redirected to login page)
        const loginButton = page.getByRole('button', { name: 'Enter Local Theater' });
        if (await loginButton.isVisible()) {
            await loginButton.click();
        }

        // 2. Open first scene found (e.g. sailboat)
        const sceneCard = page.getByTestId('scene-item-sailboat').first();
        // If not found, fall back to any scene item
        const anyScene = page.locator('[data-testid^="scene-item-"]').first();

        await expect(anyScene).toBeVisible();
        await anyScene.click();

        // 3. Play the scene to show canvas
        const playButton = page.getByRole('button', { name: 'Play Scene' });
        if (await playButton.isVisible()) {
            await playButton.click();
            // 4. Verify canvas element is present
            await expect(page.locator('canvas')).toBeVisible();
        } else {
            // If no play button (maybe sprite view?), just check for image
            await expect(page.locator('img').first()).toBeVisible();
        }

        // Wait a bit to ensure potential animations start (optional)
        await page.waitForTimeout(1000);

        // Check for no console errors?
        // Listen for console events
        page.on('console', msg => {
            if (msg.type() === 'error')
                console.log(`Error text: "${msg.text()}"`);
        });
    });

    // Coverage collection hook
    test.afterEach(async ({ page }, testInfo) => {
        const coverage = await page.evaluate(() => window.__coverage__);
        if (coverage) {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);

            // Sanitize test title for filename
            const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

            const coverageJSON = JSON.stringify(coverage);
            // Ensure coverage directory exists
            const coverageDir = join(__dirname, '..', '.nyc_output');
            if (!fs.existsSync(coverageDir)) {
                fs.mkdirSync(coverageDir, { recursive: true });
            }
            fs.writeFileSync(join(coverageDir, `coverage-${sanitizedTitle}.json`), coverageJSON);
        }
    });
});
