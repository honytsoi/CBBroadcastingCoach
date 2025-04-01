# Test Documentation

This document describes the unit tests implemented in the `tests/` directory and outlines the scope of testing, including what is covered and what is not.

## Overview

The unit tests use the built-in `node:test` runner to verify the functionality of the following modules:

-   `static/src/api/cloudflareWorker.js` (Note: Currently untested, `test.js` seems to cover this but uses Jest - needs consolidation)
-   `static/src/config.js` (Note: Currently untested, `test.js` seems to cover this but uses Jest - needs consolidation)
-   `static/src/storage-manager.js` (Covered in `tests/storage-manager.test.js`)
-   `static/src/user-manager.js` (Partially covered in `tests/user-manager.test.js`)

## Tested Functionality

The following functionality is covered by the tests:

-   **`static/src/api/cloudflareWorker.js`:**
    -   `getSessionKey`: Verifies that the function returns a valid session key and expiration time.
    -   `generateCoachingPrompt`: Verifies that the function generates a prompt successfully.
    -   `getAvailableModels`: Verifies that the function returns a list of available AI models.
-   **`static/src/config.js`:** (Tests likely exist in `test.js` but need migration to `node:test`)
    -   `loadConfig`: Verifies loading configuration from localStorage.
    -   `saveConfig`: Verifies saving configuration to localStorage.
-   **`static/src/storage-manager.js` (`tests/storage-manager.test.js`):**
    -   `saveUserData`: Verifies saving user data Map to localStorage, including handling chat history limits and quota errors.
    -   `loadUserData`: Verifies loading and parsing user data from localStorage, handling missing or invalid data.
    -   `handleQuotaError`: Verifies the logic for reducing the user map when storage quota is exceeded.
-   **`static/src/user-manager.js` (`tests/user-manager.test.js`):**
    -   `importTokenHistory`: Verifies parsing of token history CSV data, creation of user events (including tips and private show meta-events), and handling of duplicates.
    -   `loadUsers` (Interaction): Verifies that it correctly calls `storageManager.loadUserData` and processes the returned map (merging defaults, resetting online status).
    -   `saveUsers` (Interaction): Verifies that it correctly calls `storageManager.saveUserData` and handles potential errors (including quota errors by calling `storageManager.handleQuotaError` and retrying).

## Untested Functionality

Due to the nature of the application and the testing environment, some functionality is not directly tested. This includes:

-   **DOM Interaction:** The tests mock the `document` object, so the actual interaction with the DOM is not tested. This means that the tests do not verify whether the UI elements are updated correctly.
-   **`speechSynthesis`:** The tests mock the `speechSynthesis` object, so the actual text-to-speech functionality is not tested. This means that the tests do not verify whether the correct voices are being used or whether the audio is being played correctly.
-   **`window.addActivityItem`:** The tests mock the `window.addActivityItem` function, so the actual addition of activity items to the UI is not tested.
-   **API calls:** The tests mock the `fetch` function, so the actual API calls to the backend are not tested. This means that the tests do not verify whether the correct data is being sent to the backend or whether the backend is returning the correct responses.
-   **Real-time Event Streaming:** The tests do not cover the real-time event streaming functionality, as this would require a more complex testing setup.

## Mocking

The following objects and functions are mocked in the tests:

-   `localStorage`: Mocked to simulate the behavior of localStorage.
-   `document`: Mocked to simulate the DOM.
-   `speechSynthesis`: Mocked to prevent actual speech synthesis.
-   `window`: Mocked to prevent errors related to missing window properties.
-   `fetch`: Mocked to simulate API calls.
-   `initConfig`: Mocked to prevent the function from trying to access the DOM.
-   `loadConfig`: Mocked to prevent the function from trying to access the DOM.
-   `saveConfig`: Mocked to prevent the function from trying to access the DOM (in `test.js`).
-   `static/src/storage-manager.js`: Functions (`saveUserData`, `loadUserData`, `handleQuotaError`) are mocked within `tests/user-manager.test.js` to isolate `UserManager` logic.
-   `static/src/displayError.js`: The `displayError` function is mocked within `tests/user-manager.test.js` to prevent side effects during error handling tests.

## Limitations

The tests provide a basic level of coverage for the core functionality of the application. However, due to the limitations of the testing environment and the mocking of certain objects and functions, some functionality is not directly tested.

Future improvements could include:

-   Integration tests to verify the interaction between different modules.
-   End-to-end tests to verify the functionality of the application in a real browser environment.

## Headless Browser Tests

In addition to unit tests, this project includes headless browser tests using Puppeteer. These tests automate browser interactions to verify the functionality of the application in a real browser environment.

### Running Headless Tests

To run the headless tests, use the following command:

```bash
./run-headless-tests.sh
```

This script:
1. Checks for and kills any existing processes on port 8787
2. Starts the development server in the background
3. Waits for the server to start
4. Runs the headless browser tests
5. Captures the test exit code
6. Shuts down the server and cleans up any remaining processes
7. Returns the appropriate exit code

#### Debug Mode

For debugging, you can run the tests with the browser visible (non-headless mode):

```bash
DEBUG=1 ./run-headless-tests.sh
```

This will launch a visible browser window so you can see the test interactions in real-time.

### Requirements for ARM Systems

When running on ARM-based systems (like this environment), the tests use the system-installed Chromium browser instead of the version downloaded by Puppeteer. Make sure Chromium is installed:

```bash
sudo apt-get update && sudo apt-get install -y chromium-browser
```

### Test Coverage

The headless tests currently cover:
- Loading the application
- Opening the configuration panel
- Filling in form fields
- Additional browser interaction tests can be added in the `tests/headless/` directory

### Screenshots

The headless tests automatically capture screenshots at key steps in the test process, providing visual verification of the test execution. Screenshots are saved in the `tests/headless/screenshots` directory with timestamped filenames.

Screenshots are captured at the following points:
1. Initial page load
2. Before clicking the configuration button
3. After opening the configuration section
4. After filling in form fields
5. In case of test errors

By default, all screenshots are kept. You can use these command line options:
- `--clean-screenshots`: Remove all existing screenshots before running tests
- `--no-screenshots`: Don't keep screenshots from previous test runs

If you're running frequent tests and want to see the visual flow of your application, these screenshots provide a timeline of the user interface during test execution.