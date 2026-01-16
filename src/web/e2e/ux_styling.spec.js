/**
 * UX Styling E2E Tests
 * 
 * Validates visual style consistency across the application.
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { ensureSceneExists } from './utils.js';

test.describe('UX Styling', () => {
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
            fs.writeFileSync(join(coverageDir, `coverage-ux-styling-${sanitizedTitle}.json`), coverageJSON);
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

    test('toolbar icons use consistent sizing', async ({ page }) => {
        // Open a scene to get the theatre view
        const sceneItem = page.locator('[data-testid^="item-"]').first();
        await sceneItem.click();

        // Wait for theatre to load
        await page.waitForSelector('canvas', { timeout: 5000 });

        // Find all btn-icon elements
        const icons = await page.locator('.btn-icon').all();

        if (icons.length === 0) {
            test.skip();
            return;
        }

        const sizes = [];

        for (const icon of icons) {
            const box = await icon.boundingBox();
            if (box && box.width > 0 && box.height > 0) {
                // Round to nearest 4px for tolerance
                const roundedW = Math.round(box.width / 4) * 4;
                const roundedH = Math.round(box.height / 4) * 4;
                sizes.push(`${roundedW}x${roundedH}`);
            }
        }

        // Count unique sizes
        const uniqueSizes = [...new Set(sizes)];

        // Allow at most 3 different icon sizes (small, medium, large)
        expect(uniqueSizes.length, `Found ${uniqueSizes.length} different icon sizes: ${uniqueSizes.join(', ')}`).toBeLessThanOrEqual(3);
    });

    test('btn-icon hover effects are functional', async ({ page }) => {
        // Open a scene
        const sceneItem = page.locator('[data-testid^="item-"]').first();
        await sceneItem.click();

        await page.waitForSelector('canvas', { timeout: 5000 });

        // Find a btn-icon that's not inside a special overlay
        const button = page.locator('.btn-icon').first();

        if (!await button.isVisible().catch(() => false)) {
            test.skip();
            return;
        }

        // Get styles before hover
        const beforeStyles = await button.evaluate(el => {
            const styles = getComputedStyle(el);
            return {
                background: styles.backgroundColor,
                color: styles.color,
            };
        });

        // Hover over the button
        await button.hover();
        await page.waitForTimeout(300); // Allow transition

        // Get styles after hover
        const afterStyles = await button.evaluate(el => {
            const styles = getComputedStyle(el);
            return {
                background: styles.backgroundColor,
                color: styles.color,
            };
        });

        // At least one property should change on hover (effect is working)
        const hasHoverEffect =
            beforeStyles.background !== afterStyles.background ||
            beforeStyles.color !== afterStyles.color;

        expect(hasHoverEffect, 'btn-icon should have visible hover effect').toBe(true);
    });

    test('design tokens are used for text colors', async ({ page }) => {
        // Check that main text uses CSS variable-based colors
        const textElements = await page.locator('h1, h2, h3, p, span').all();

        let hardcodedCount = 0;
        const hardcodedColors = ['rgb(0, 0, 0)', 'rgb(255, 255, 255)', '#000', '#fff', '#000000', '#ffffff'];

        for (const el of textElements.slice(0, 20)) { // Check first 20
            if (!await el.isVisible().catch(() => false)) continue;

            const color = await el.evaluate(e => getComputedStyle(e).color);

            // Check if it's a raw black/white instead of theme color
            if (hardcodedColors.includes(color)) {
                hardcodedCount++;
            }
        }

        // Allow some hardcoded (canvas overlays may legitimately use white)
        expect(hardcodedCount, `Found ${hardcodedCount} elements with hardcoded black/white text`).toBeLessThan(5);
    });

    test('toolbar backgrounds use theme-consistent colors', async ({ page }) => {
        // Open a scene
        const sceneItem = page.locator('[data-testid^="item-"]').first();
        await sceneItem.click();

        await page.waitForSelector('canvas', { timeout: 5000 });

        // Check the TopBar background
        const topBar = page.locator('header').first();
        if (await topBar.isVisible().catch(() => false)) {
            const bg = await topBar.evaluate(el => getComputedStyle(el).backgroundColor);

            // Should not be pure black or pure white
            expect(bg).not.toBe('rgb(0, 0, 0)');
            expect(bg).not.toBe('rgb(255, 255, 255)');
        }
    });
});
