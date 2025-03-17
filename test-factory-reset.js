const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('http://localhost:8787');

    // Wait for the configuration section to be visible
    await page.waitForSelector('#configSection');

    // Click the configuration toggle button to open the configuration section
    await page.click('#configToggle');

    // Wait for the factory reset button to be visible
    await page.waitForSelector('#factoryReset');

    // Click the factory reset button
    await page.click('#factoryReset');

    // Confirm the factory reset action
    await page.on('dialog', async dialog => {
        await dialog.accept();
    });

    // Wait for the page to reload
    await page.waitForNavigation();

    // Close the browser
    await browser.close();
})();
