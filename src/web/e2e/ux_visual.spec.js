/**
 * UX Visual E2E Tests
 * 
 * Performance visual regression checks using snapshots.
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { ensureSceneExists } from './utils.js';

test.describe('UX Visual Regression', () => {
    // Coverage collection hook
    test.afterEach(async ({ page }, testInfo) => {
        const coverage = await page.evaluate(() => window.__coverage__);
        if (coverage) {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);

            // Sanitize test title for filename
            const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

            const coverageJSON = JSON.stringify(coverage);
            const coverageDir = join(__dirname, '..', '.nyc_output');
            if (!fs.existsSync(coverageDir)) {
                fs.mkdirSync(coverageDir, { recursive: true });
            }
            fs.writeFileSync(join(coverageDir, `coverage-ux-visual-${sanitizedTitle}.json`), coverageJSON);
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Handle login if needed
        const loginButton = page.getByRole('button', { name: 'Enter Local Theater' });
        if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginButton.click();
        }

        // Ensure a scene exists for consistency tests
        await ensureSceneExists(page);
    });

    test('visual snapshot - Theatre view', async ({ page }) => {
        // Open a scene
        const sceneItem = page.locator('[data-testid^="item-"]').first();
        await sceneItem.click();

        await page.waitForSelector('canvas', { timeout: 5000 });
        await page.waitForTimeout(1000); // Let animations settle

        // Take a screenshot excluding the canvas (which changes)
        const pageWithoutCanvas = page.locator('body');

        // This creates a baseline on first run, compares on subsequent runs
        await expect(pageWithoutCanvas).toHaveScreenshot('theatre-view.png', {
            maxDiffPixels: 7000,
            mask: [page.locator('canvas')], // Mask dynamic canvas content
        });
    });

    test('visual snapshot - Scene list', async ({ page }) => {
        // Should already be on the scene list from beforeEach
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('scene-list.png', {
            maxDiffPixels: 2000,
        });
    });
});
