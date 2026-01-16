/**
 * UX Accessibility E2E Tests
 * 
 * Validates accessibility and usability across the application.
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { ensureSceneExists } from './utils.js';

test.describe('UX Accessibility', () => {
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
            fs.writeFileSync(join(coverageDir, `coverage-ux-access-${sanitizedTitle}.json`), coverageJSON);
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
