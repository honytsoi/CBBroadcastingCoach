# Test Documentation

This document describes the tests implemented in `test.js` and outlines the scope of testing, including what is covered and what is not.

## Overview

The tests in `test.js` use the `jest` testing framework to verify the functionality of the following modules:

-   `static/src/api/cloudflareWorker.js`
-   `static/src/config.js`

## Tested Functionality

The following functionality is covered by the tests:

-   **`static/src/api/cloudflareWorker.js`:**
    -   `getSessionKey`: Verifies that the function returns a valid session key and expiration time.
    -   `generateCoachingPrompt`: Verifies that the function generates a prompt successfully.
    -   `getAvailableModels`: Verifies that the function returns a list of available AI models.
-   **`static/src/config.js`:**
    -   `loadConfig`: Verifies that the function loads the configuration from localStorage correctly.
    -   `saveConfig`: Verifies that the function saves the configuration to localStorage correctly.

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
-   `saveConfig`: Mocked to prevent the function from trying to access the DOM.

## Limitations

The tests provide a basic level of coverage for the core functionality of the application. However, due to the limitations of the testing environment and the mocking of certain objects and functions, some functionality is not directly tested.

Future improvements could include:

-   Integration tests to verify the interaction between different modules.
-   End-to-end tests to verify the functionality of the application in a real browser environment.