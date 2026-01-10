import fs from 'fs';
import path from 'path';

/**
 * Ensures at least one scene exists. If not, creates a dummy scene.
 * @param {import('@playwright/test').Page} page 
 */
export async function ensureSceneExists(page) {
    // 0. Wait for App Initialization
    console.log('Waiting for app initialization (spinner)...');
    try {
        await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
        console.log('Spinner detached.');
    } catch (e) {
        console.log('Spinner did not detach (or was never present):', e.message);
    }

    // Ensure App Shell is loaded
    console.log('Waiting for .app-container...');
    try {
        await page.waitForSelector('.app-container', { timeout: 15000 });
        console.log('.app-container found.');
    } catch (e) {
        console.log('Error waiting for .app-container:', e.message);
        // Don't return, try to proceed, but it will likely fail
    }

    // 0. Handle Welcome Screen: If "Open Scene" is visible, click it to go to selection view
    const openSceneBtn = page.locator('[data-testid="welcome-open-scene"]');
    const isWelcome = await openSceneBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (isWelcome) {
        console.log('On Welcome Screen. Clicking "Open Scene"...');
        await openSceneBtn.click();
    } else {
        console.log('"Open Scene" button not visible. Assuming we are already in Scene Selection or elsewhere.');
    }

    // 1. Check if any scene is already visible
    const sceneItem = page.locator('[data-testid^="scene-item-"]').first();
    const sceneExists = await sceneItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (sceneExists) {
        console.log('Scene found.');
        return;
    }

    console.log('No scenes found, creating a dummy test scene...');

    // 2. Open Create Dialog
    const createBtn = page.locator('[data-testid="create-scene-button"]');
    // Ensure we await visibility before clicking to avoid immediate failure if it's animating
    await createBtn.waitFor({ state: 'visible', timeout: 10000 });
    await createBtn.click();

    // 3. Select "Upload Scene"
    const uploadOption = page.locator('[data-testid="create-option-upload-scene"]');
    await uploadOption.click();

    // 4. Fill form
    await page.fill('#scene-name', 'test_scene');

    // 5. Create dummy 1x1 PNG
    // A tiny red pixel PNG
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const filePath = path.join(process.cwd(), 'test-dummy.png');
    fs.writeFileSync(filePath, Buffer.from(dummyPngBase64, 'base64'));

    // 6. Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // 7. Submit
    const submitBtn = page.locator('[data-testid="upload-scene-submit"]');
    await submitBtn.click();

    // 8. Wait for redirection or success
    // We expect to land on scene-detail view which has a canvas or some indicator
    await page.waitForSelector('canvas, [data-testid="scene-detail-view"]', { timeout: 15000 }).catch(() => {
        console.log('Redirection to scene-detail might be slow, clicking "Open Scene" manually if needed');
    });

    // Go back to main if we are stuck
    if (page.url().includes('create')) {
        await page.goto('/');
        // Handle login again if it kicks us out (unlikely but safe)
        const loginButton = page.getByRole('button', { name: 'Enter Local Theater' });
        if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginButton.click();
        }
    }

    // Clean up dummy file
    try {
        fs.unlinkSync(filePath);
    } catch {
        // Ignore
    }
}
