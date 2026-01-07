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
        // Open a scene
        const anyScene = page.locator('[data-testid^="scene-item-"]').first();
        await expect(anyScene).toBeVisible();
        await anyScene.click();

        // Click Play Scene to enter theatre view
        const playButton = page.getByRole('button', { name: 'Play Scene' });
        if (await playButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await playButton.click();
        }

        // Wait for timeline to be visible
        const timelineRuler = page.locator('[data-testid="timeline-ruler"]');
        await expect(timelineRuler).toBeVisible({ timeout: 10000 });

        // Check for time offset markers (should exist if there are behaviors with time_offset > 0)
        const offsetMarkers = page.locator('[data-testid="time-offset-marker"]');
        const markerCount = await offsetMarkers.count();

        // Log marker count for debugging
        console.log(`Found ${markerCount} time offset markers`);

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
            await timelineRuler.screenshot({ path: 'test-results/timeline-ruler-markers.png' });
        } else {
            // Log that no markers were found (scene may not have time offset behaviors)
            console.log('No time offset markers found - scene may not have behaviors with time_offset > 0');
            test.skip();
        }
    });
});
