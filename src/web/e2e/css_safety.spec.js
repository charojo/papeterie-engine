
/**
 * CSS Safety Regression Tests
 * 
 * Targeted visual tests to ensure CSS refactoring doesn't break core layouts.
 * Run via: npx playwright test e2e/css_safety.spec.js
 */

import { test, expect } from '@playwright/test';
import { ensureSceneExists } from './utils.js';

test.describe('CSS Safety Checks', () => {

    test.beforeEach(async ({ page }) => {
        // Ensure we handle any auth redirection if needed, though dev usually bypasses
        await page.goto('/');

        // Handle login if needed
        const loginButton = page.getByRole('button', { name: 'Enter Local Theater' });
        if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginButton.click();
        }
    });

    test('Safety Snapshot: Landing / Scene List', async ({ page }) => {
        // Verify critical elements exist before snapshot
        // Since default view is "scene-selection", we expect the scene selection grid
        await expect(page.getByText('Open a Scene')).toBeVisible();

        await expect(page).toHaveScreenshot('safety-landing.png', {
            maxDiffPixels: 2000,
            fullPage: true
        });
    });

    test('Safety Snapshot: Theatre View Layout', async ({ page }) => {
        // Ensure scene exists to open
        await ensureSceneExists(page);

        // Open the first scene
        const sceneItem = page.locator('[data-testid^="item-"]').first();
        await sceneItem.click();

        // Wait for core layout elements
        await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.timeline-ruler-container')).toBeVisible();

        // Wait a bit for layout to settle
        await page.waitForTimeout(1000);

        // Snapshot body but MASK the canvas (animations cause flake) and time-sensitive elements
        await expect(page.locator('body')).toHaveScreenshot('safety-theatre-layout.png', {
            maxDiffPixels: 5000,
            mask: [
                page.locator('canvas'),
                page.locator('.timeline-playhead-line')
            ],
            fullPage: true
        });
    });

    test('Safety Snapshot: Export Dialog', async ({ page }) => {
        await ensureSceneExists(page);
        const sceneItem = page.locator('[data-testid^="item-"]').first();
        await sceneItem.click();
        await expect(page.locator('canvas')).toBeVisible();

        // Open Export Dialog
        const exportBtn = page.getByRole('button', { name: /Export/i });

        // In case the menu is collapsed or different, check visibility
        if (await exportBtn.isVisible()) {
            await exportBtn.click();
            // ExportDialog uses .modal-container and has header "Export Video"
            await expect(page.getByText('Export Video')).toBeVisible();
            await expect(page.locator('.modal-container')).toBeVisible();

            // Take snapshot of dialog
            await expect(page.locator('.modal-container')).toHaveScreenshot('safety-export-dialog.png');
        } else {
            console.log('Export button not found, skipping dialog snapshot');
        }
    });
});
