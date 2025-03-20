
// tests/headless/test-example.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Check if we should run in headless mode or not (for debugging)
// Use DEBUG=1 ./run-headless-tests.sh to run in non-headless mode
const headlessMode = process.env.DEBUG ? false : 'new';

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Helper function to take and save a screenshot
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(screenshotsDir, `${name}-${timestamp}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot saved: ${filePath}`);
  return filePath;
}

(async () => {
  console.log(`Running tests with headless mode: ${headlessMode ? 'enabled' : 'disabled (debug mode)'}`);
  
  // Launch browser - using system-installed Chromium for ARM compatibility
  const browser = await puppeteer.launch({ 
    headless: headlessMode,  // Use new headless mode unless in debug mode
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Set viewport size for consistent screenshots
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to local server
    await page.goto('http://localhost:8787');
    console.log('Page loaded successfully');
    await takeScreenshot(page, '01-initial-page-load');
    
    // Test configuration button
    await page.waitForSelector('#configToggle');
    console.log('Configuration toggle button found');
    await takeScreenshot(page, '02-before-click-config');
    
    // Click configuration button
    await page.click('#configToggle');
    console.log('Clicked configuration toggle button');
    
    // Wait for configuration section to be visible
    await page.waitForSelector('#configSection', { visible: true });
    console.log('Configuration section opened successfully!');
    await takeScreenshot(page, '03-config-section-opened');
    
    // Test filling in form fields
    await page.type('#broadcasterName', 'TestBroadcaster');
    await page.type('#preferences', 'Test preferences text');
    console.log('Filled in form fields');
    await takeScreenshot(page, '04-form-filled');
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test error:', error);
    await takeScreenshot(page, 'error-state');
    throw error;
  } finally {
    // Close browser
    await browser.close();
  }
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});