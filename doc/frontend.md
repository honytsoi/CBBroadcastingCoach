# Frontend Documentation

This document provides detailed information about the frontend components of the CB Broadcasting Real-Time Coach application.

## Overview

The frontend is a single-page web application built with HTML, CSS, and JavaScript. It provides a user interface for configuring the application, connecting to the Chaturbate Events API, and receiving coaching prompts.

## Directory Structure

```
frontend/
├── index.html           # Main HTML file
├── styles/
│   └── main.css         # Main stylesheet
└── src/
    ├── app.js           # Main application logic
    ├── config.js        # Configuration management
    ├── qr-scanner.js    # QR code scanning functionality
    └── api/
        └── openrouter.js # OpenRouter API integration
```

## Components

### HTML Structure (index.html)

The main HTML file defines the structure of the application, including:

- Header with title and settings button
- Configuration section with form fields for settings
- Main content area with:
  - QR scanner section for connecting to the Chaturbate Events API
  - Activity feed for displaying events
  - Prompt feed for displaying coaching prompts
- Status bar showing connection status and last prompt time

### Styles (main.css)

The main stylesheet provides styling for the application, including:

- Layout and positioning
- Colors and typography
- Form elements
- Feed displays
- Responsive design for mobile and desktop

### JavaScript Modules

#### Main Application (app.js)

The main application module:

- Initializes the application
- Manages application state
- Handles event processing from the Chaturbate Events API
- Coordinates between other modules
- Manages the activity and prompt feeds
- Handles text-to-speech functionality

Key functions:
- `addActivityItem`: Adds an item to the activity feed and context
- `addPromptItem`: Adds a prompt to the prompt feed and speaks it
- `connectToEventAPI`: Connects to the Chaturbate Events API
- `processEvent`: Processes events from the API and triggers prompt generation

#### Configuration (config.js)

The configuration module:

- Manages user settings and preferences
- Handles saving and loading configuration from localStorage
- Provides a UI for configuring the application
- Tests the OpenRouter API connection

Key functions:
- `initConfig`: Initializes the configuration module
- `loadConfig`: Loads saved configuration from localStorage
- `saveConfig`: Saves configuration to localStorage
- `testApiConnection`: Tests the OpenRouter API connection

#### QR Scanner (qr-scanner.js)

The QR scanner module:

- Provides functionality for scanning QR codes using the device camera
- Validates QR codes to ensure they contain a valid Chaturbate Events API URL
- Handles camera permissions and video streaming

Key functions:
- `initQRScanner`: Initializes the QR scanner module
- `startQRScanner`: Starts the QR code scanner
- `stopQRScanner`: Stops the QR code scanner
- `scanForQRCode`: Scans for QR codes in the video stream

#### OpenRouter API (api/openrouter.js)

The OpenRouter API module:

- Handles communication with the OpenRouter API
- Formats context data for AI prompt generation
- Processes API responses

Key functions:
- `generateCoachingPrompt`: Generates a coaching prompt using the OpenRouter API

## Data Flow

1. User configures the application using the settings form
2. User scans the Chaturbate Events API QR code
3. Application connects to the Chaturbate Events API
4. Events are received and processed
5. Context is built from events
6. Periodically, context is sent to the OpenRouter API to generate coaching prompts
7. Prompts are displayed and spoken to the user

## Future Changes

The frontend will be updated to work with the planned Cloudflare Worker backend instead of directly calling the OpenRouter API. This will involve:

1. Removing the OpenRouter API key configuration field
2. Updating the `openrouter.js` module to call the new backend API instead
3. Simplifying the configuration process for users

See the [Backend Documentation](backend.md) for more details on the planned backend implementation.
