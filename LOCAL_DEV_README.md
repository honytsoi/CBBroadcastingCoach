# Broadcasting Coach - Local Development

This guide explains how to run the Broadcasting Coach application locally using Cloudflare Workers.

## Project Structure

The project is now set up with the following structure:

- `static/` - Contains all static assets (HTML, CSS, JavaScript files)
- `src/` - Contains the worker code
  - `src/index.js` - Main worker code that handles API requests and serves static files
- `wrangler.jsonc` - Cloudflare Workers configuration file

## How It Works

The application uses Cloudflare Workers with the following configuration:

1. **Static Assets**: Served directly from the `static/` directory using Cloudflare's built-in site functionality
2. **API Endpoints**: Handled by the worker code in `src/index.js`
   - `/api/generate-prompt` - Generates coaching prompts using AI
   - `/api/get-session-key` - Creates a session key for authentication

## Running Locally

To run the application locally:

```bash
./start-local.sh
```

This script will:
- Install dependencies if needed
- Start the local development server using Wrangler
- Make the application available at http://localhost:8787

## API Testing

You can test the API endpoints using curl or a tool like Postman:

```bash
# Get a session key
curl -X POST http://localhost:8787/api/get-session-key \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user","broadcaster":"test_broadcaster"}'

# Generate a coaching prompt
curl -X POST http://localhost:8787/api/generate-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "context": [{"type":"chat","text":"User: Hello!","timestamp":"2025-03-13T08:30:00Z"}],
    "broadcaster": "test_broadcaster",
    "preferences": "Keep it fun and engaging",
    "sessionKey": "[SESSION_KEY_FROM_PREVIOUS_REQUEST]"
  }'
```

## Deploying to Production

To deploy the application to Cloudflare:

```bash
wrangler deploy
```

This will deploy your worker and static assets to Cloudflare's global network.
