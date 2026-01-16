import { test, expect } from '@playwright/test';
import { ensureSceneExists } from './utils.js';

test.describe('Timeline Editor Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate and ensure a scene exists
        await page.goto('/');

        // Handle Login if needed
        const loginButton = page.getByRole('button', { name: 'Enter Local Theater' });
        if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginButton.click();
        }

        await ensureSceneExists(page);
    });

    test('time offset triangle markers are visible in timeline ruler', async ({ page }) => {
        // Check if we are already in Scene Detail view (e.g. if ensureSceneExists created a new scene)
        const playButton = page.getByRole('button', { name: 'Play Scene' });
        const inSceneDetail = await playButton.isVisible({ timeout: 1000 }).catch(() => false);

        if (!inSceneDetail) {
            // Open a scene from the list
            const anyScene = page.locator('[data-testid^="item-"]').first();
            await expect(anyScene).toBeVisible();
            await anyScene.click();
        }

        // Click Play Scene to enter theatre view
        if (await playButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await playButton.click();
        }

        // Wait for timeline to be visible
        const timelineRuler = page.locator('[data-testid="timeline-ruler"]');
        await expect(timelineRuler).toBeVisible({ timeout: 10000 });

        // Check for time offset markers (should exist if there are behaviors with time_offset > 0)
        let offsetMarkers = page.locator('[data-testid="time-offset-marker"]');
        let markerCount = await offsetMarkers.count();

        // Log marker count for debugging
        console.log(`Found ${markerCount} time offset markers`);

        if (markerCount === 0) {
            console.log('No markers found, adding a behavior at 5s...');
            // 1. Move playhead to 5s
            const scrubber = page.locator('.timeline-scrubber');
            await scrubber.fill('5');
            await page.waitForTimeout(500);

            console.log('2. Clicking "Add Behavior" for the first visible sprite in the list');

            // Try to find the button inside a sprite accordion item specifically
            // The structure is roughly: .card-interactive > div (header) > .sl-col-add > button
            const addBehaviorBtn = page.locator('.card-interactive .sl-col-add button[title="Add Behavior"]').first();
            await addBehaviorBtn.waitFor({ state: 'visible', timeout: 5000 });
            await addBehaviorBtn.click();

            // 3. Select a behavior type from the menu
            // We expect the menu to be open now.
            // Use a highly specific selector for the menu item to avoid ambiguity
            const behaviorOption = page.locator('.sl-behavior-menu-item').filter({ hasText: 'Location' });
            await behaviorOption.waitFor({ state: 'visible', timeout: 5000 });
            await behaviorOption.click({ force: true });

            console.log('4. Waiting for behavior to be added to the list');
            // Wait for the behavior to appear in the list (it should be expanded)
            await page.locator('.sl-expanded-content').first().waitFor({ state: 'visible', timeout: 5000 });

            console.log('5. Waiting for marker to appear');
            // 5. Wait for marker to appear
            // Force a small wait to ensure canvas/timeline re-renders
            await page.waitForTimeout(1000);
            await expect(page.locator('[data-testid="time-offset-marker"]').first()).toBeVisible({ timeout: 5000 });

            // Re-count markers
            offsetMarkers = page.locator('[data-testid="time-offset-marker"]');
            markerCount = await offsetMarkers.count();
            console.log(`Found ${markerCount} markers after adding behavior`);
        }

        if (markerCount > 0) {
            // Verify the first marker is visible
            const firstMarker = offsetMarkers.first();
            await expect(firstMarker).toBeVisible();

            // Verify the marker has a title attribute for accessibility
            const title = await firstMarker.getAttribute('title');
            expect(title).toMatch(/Keyframe at \d+\.\d+s/);

            // Verify the triangle element exists inside
            const triangle = firstMarker.locator('div');
            await expect(triangle).toBeVisible();

            // Visual check: take a screenshot of the ruler area
            await expect(timelineRuler).toHaveScreenshot('timeline-ruler-markers.png', {
                maxDiffPixels: 500
            });
        } else {
            throw new Error('Failed to create or find time offset markers');
        }
    });
});
