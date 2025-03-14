# CB Broadcasting Real-Time Coach

A web application designed to assist Chaturbate broadcasters with real-time coaching prompts delivered via audio.

## Overview

Broadcasting Real-Time Coach is a single-page web application that helps broadcasters improve their streaming performance by providing real-time coaching suggestions. The app connects to Chaturbate's event API, monitors chat activity, and uses AI to generate contextually relevant prompts that are delivered to the broadcaster through audio.

## Features

- **QR Code Scanner**: Easily connect to your Chaturbate stream by scanning the event API QR code
- **Real-time Event Monitoring**: Track chat messages, tips, and user activity
- **AI-Powered Coaching**: Receive contextually relevant suggestions based on stream activity
- **Audio Prompts**: Get coaching suggestions delivered directly to your ear via text-to-speech
- **Customizable Settings**: Configure AI model, language, prompt delay, and personal preferences

## Requirements

- A modern web browser (Chrome, Firefox, Safari, Edge)
~~- An OpenRouter API key for AI functionality~~
- Uses Cloudflare Worker AI
- A Chaturbate account with access to the Events API
- A device with a camera for QR code scanning (typically a smartphone)
- Headphones or earbuds for private audio prompts

## Setup Instructions

1. Open the application in your web browser
2. Click the "Settings" button (⚙️) to configure the app:
   ~~- Enter your OpenRouter API key~~
   - Select your preferred AI model
   ~~- Enter your Chaturbate username~~
   - Your CB username is picked up from the QR Code
   - Choose your preferred language for audio prompts
   - Set the delay between prompts (in seconds)
   - Add any preferences or topics to avoid
3. Click "Save Configuration"
4. Start your Chaturbate broadcast on your computer
5. On your phone, click "Scan QR Code" and scan the QR code displayed on your broadcast page
6. Once connected, put in your earbuds to receive private coaching prompts

## Privacy & Security

- Your ~~API keys and~~ preferences are stored locally in your browser
- No data is sent to any server except the Chaturbate API and ~~OpenRouter~~ CloudFlare API
- The app does not record or store your broadcasts

## Technical Details

- Built with HTML, CSS, and JavaScript
- Uses jsQR for QR code scanning
- Connects to Chaturbate's Events API using Server-Sent Events (SSE)
- Uses ~~OpenRouter~~ CloudFlare API for AI-generated coaching prompts
- Implements Web Speech API for text-to-speech functionality

## Usage Tips

- Position your phone where you can easily see it during your broadcast
- Use a single earbud to hear prompts while still being able to hear other sounds
- Adjust the prompt delay based on your preference (shorter for more frequent prompts, longer for fewer interruptions)
- Be specific in your preferences to get more relevant coaching suggestions

## Troubleshooting

- If the QR code scanner doesn't work, ensure you've granted camera permissions to the app
- If you're not receiving audio prompts, check that your device's volume is turned up and audio is enabled in the app
- If the connection to the Events API fails, try refreshing the page and scanning the QR code again
