import fs from 'fs';
import path from 'path';

/**
 * Ensures at least one scene exists. If not, creates a dummy scene.
 * @param {import('@playwright/test').Page} page 
 */
export async function ensureSceneExists(page) {
    // 0. Wait for App Initialization
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
        throw new Error(`Timed out waiting for .app-container. The App Shell failed to load within 15s. Original error: ${e.message}`);
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
    const sceneItem = page.locator('[data-testid^="item-"]').first();
    const sceneExists = await sceneItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (sceneExists) {
        console.log('Scene found.');
        return;
    }

    console.log('No scenes found, creating a dummy test scene...');

    // 2. Open Create Dialog
    const createBtn = page.locator('[data-testid="create-item-button"]');
    // Ensure we await visibility before clicking to avoid immediate failure if it's animating
    await createBtn.waitFor({ state: 'visible', timeout: 10000 });
    await createBtn.click();

    // 3. Select "Upload Scene"
    const uploadOption = page.locator('[data-testid="create-option-upload-scene"]');
    await uploadOption.click();

    // 4. Fill form
    const sceneName = `test_scene_${Math.floor(Math.random() * 1000)}`;
    console.log(`Using scene name: ${sceneName}`);
    await page.fill('#scene-name', sceneName);

    // 5. Create dummy 1x1 PNG
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const filePath = path.join(process.cwd(), 'test-dummy.png');
    fs.writeFileSync(filePath, Buffer.from(dummyPngBase64, 'base64'));

    // 6. Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Ensure test-results dir exists
    if (!fs.existsSync('test-results')) {
        fs.mkdirSync('test-results', { recursive: true });
    }
    await page.screenshot({ path: `test-results/create-form-${sceneName}.png` });

    // 7. Submit
    const submitBtn = page.locator('[data-testid="upload-scene-submit"]');
    await submitBtn.click();
    console.log('Submit button clicked.');

    // 8. Wait for redirection or success
    // We expect to land on scene-detail view which has a canvas or some indicator
    console.log('8. Waiting for redirection to scene detail view...');
    try {
        await page.waitForSelector('canvas, [data-testid="scene-detail-view"]', { timeout: 30000 });
        console.log('Scene detail view found.');
    } catch (e) {
        console.log('DEBUG: Failed to find scene detail view. Current URL:', page.url());
        const content = await page.content();
        console.log('DEBUG: Page HTML length:', content.length);
        throw new Error(`Timed out waiting for scene detail view after creation. Expected canvas or [data-testid="scene-detail-view"] to appear. Original error: ${e.message}`);
    }

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
