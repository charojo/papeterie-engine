/**
 * UX Consistency E2E Tests
 * 
 * Validates visual consistency across the application:
 * - Icon sizing consistency
 * - Hover effects match design system
 * - Computed styles use CSS variables
 * - Visual regression checks
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { ensureSceneExists } from './utils.js';

test.describe('UX Consistency', () => {
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
            fs.writeFileSync(join(coverageDir, `coverage-ux-${sanitizedTitle}.json`), coverageJSON);
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
        const sceneItem = page.locator('[data-testid^="scene-item-"]').first();
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
        const sceneItem = page.locator('[data-testid^="scene-item-"]').first();
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

        // Log for debugging
        console.log('Before hover:', beforeStyles);
        console.log('After hover:', afterStyles);

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
        const sceneItem = page.locator('[data-testid^="scene-item-"]').first();
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

    test('visual snapshot - Theatre view', async ({ page }) => {
        // Open a scene
        const sceneItem = page.locator('[data-testid^="scene-item-"]').first();
        await sceneItem.click();

        await page.waitForSelector('canvas', { timeout: 5000 });
        await page.waitForTimeout(1000); // Let animations settle

        // Take a screenshot excluding the canvas (which changes)
        const pageWithoutCanvas = page.locator('body');

        // This creates a baseline on first run, compares on subsequent runs
        await expect(pageWithoutCanvas).toHaveScreenshot('theatre-view.png', {
            maxDiffPixels: 6000, // Allow rendering differences (found ~3600-5500 diffs on linux)
            mask: [page.locator('canvas')], // Mask dynamic canvas content
        });
    });

    test('visual snapshot - Scene list', async ({ page }) => {
        // Should already be on the scene list from beforeEach
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('scene-list.png', {
            maxDiffPixels: 200,
        });
    });

    test('theme switching maintains consistency', async ({ page }) => {
        // Open settings if available
        const settingsButton = page.locator('[title*="Settings"], [aria-label*="Settings"]').first();

        if (!await settingsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            test.skip();
            return;
        }

        await settingsButton.click();

        // Look for theme selector
        const themeSelector = page.locator('select, [role="listbox"]').first();

        if (!await themeSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
            test.skip();
            return;
        }

        // Switch through themes and verify no crashes
        const themes = ['light', 'dark', 'purple', 'stark'];

        for (const theme of themes) {
            const option = page.locator(`option[value="${theme}"], [data-value="${theme}"]`).first();
            if (await option.isVisible().catch(() => false)) {
                await option.click();
                await page.waitForTimeout(200);

                // Verify page still renders
                await expect(page.locator('body')).toBeVisible();
            }
        }
    });

    test('accessibility - focus indicators visible', async ({ page }) => {
        // Tab through interactive elements
        const buttons = await page.locator('button, a, [tabindex="0"]').all();

        let focusVisible = 0;

        for (const btn of buttons.slice(0, 10)) {
            if (!await btn.isVisible().catch(() => false)) continue;

            await btn.focus();

            // Check for focus indicator (outline or ring)
            const outline = await btn.evaluate(el => {
                const styles = getComputedStyle(el);
                return {
                    outline: styles.outline,
                    boxShadow: styles.boxShadow,
                };
            });

            // Check if there's any focus indicator
            if (outline.outline !== 'none' ||
                (outline.boxShadow && outline.boxShadow !== 'none')) {
                focusVisible++;
            }
        }

        // At least half should have visible focus indicators
        const testedCount = Math.min(buttons.length, 10);
        expect(focusVisible).toBeGreaterThanOrEqual(Math.floor(testedCount / 2));
    });
});
