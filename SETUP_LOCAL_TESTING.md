# Local Testing Setup for Broadcasting Coach

This guide explains how to set up and run the Broadcasting Coach application in local development mode with headless browser testing.

## Prerequisites

1. Node.js (LTS version recommended)
2. npm or yarn
3. Git

## Step 1: Install Dependencies

First, ensure all required dependencies are installed:

```bash
npm install
```

## Step 2: Configure Wrangler for Local Development

The application already has a properly configured `wrangler.jsonc` file with:
- Static assets directory set to "./static"
- AI binding configured
- Development port set to 8787

No additional configuration is needed.

## Step 3: Install Headless Browser Testing Tools

The existing codebase uses Puppeteer for headless browser testing. Install Puppeteer and required dependencies:

```bash
npm install --save-dev puppeteer
```

If you'll be running in environments without a GUI (like CI/CD), you'll need additional dependencies for a complete headless environment:

```bash
# For Ubuntu/Debian systems
sudo apt-get update
sudo apt-get install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
    fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

## Step 4: Running the Application Locally

Use Wrangler to run the application in development mode:

```bash
npm run dev
# or directly
wrangler dev
```

The application will be available at http://localhost:8787.

## Step 5: Create Headless Browser Tests

Create new test files using Puppeteer for automated testing. Here's a template:

```javascript
// tests/headless/test-example.js
const puppeteer = require('puppeteer');

(async () => {
  // Launch browser - use headless: true for CI environments
  const browser = await puppeteer.launch({ 
    headless: 'new',  // Use new headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Navigate to local server
  await page.goto('http://localhost:8787');
  
  // Perform test actions
  // Example: Test configuration button
  await page.waitForSelector('#configToggle');
  await page.click('#configToggle');
  await page.waitForSelector('#configSection', { visible: true });
  
  console.log('Configuration section opened successfully!');
  
  // Close browser
  await browser.close();
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
```

## Step 6: Run Tests

Create a script to run the tests after the server is started:

```bash
#!/bin/bash
# run-headless-tests.sh

# Start the server in background
npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Run tests
node tests/headless/test-example.js

# Capture exit code
TEST_EXIT_CODE=$?

# Kill server
kill $SERVER_PID

# Exit with test exit code
exit $TEST_EXIT_CODE
```

Make the script executable:

```bash
chmod +x run-headless-tests.sh
```

## Step 7: Sample Test Cases

Here are some test cases to consider implementing:

1. **Basic Rendering Test**: Verify that the application loads properly
2. **Configuration Test**: Test saving and loading configuration
3. **QR Code Scanner Test**: Simulate QR code scanning
4. **User Interface Test**: Test UI elements like activity feed
5. **Error Handling Test**: Verify error messages display correctly
6. **Factory Reset Test**: Test the factory reset functionality (example already exists)

## Troubleshooting

- **Error: Browser Failed to Start**: Ensure you have all system dependencies installed
- **Connection Refused**: Make sure Wrangler is running on port 8787
- **Tests Failing Intermittently**: Add appropriate wait times for asynchronous operations

## Continuous Integration

For CI environments, ensure your setup includes:

```yaml
# Example GitHub Actions workflow
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build --if-present
      - run: ./run-headless-tests.sh
```