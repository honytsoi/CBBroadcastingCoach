# Enabling CORS on the Backend API

This guide explains how to enable Cross-Origin Resource Sharing (CORS) on the Cloudflare Worker backend to allow frontend applications from other domains to access the API.

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a security mechanism that restricts web applications running at one origin from making requests to another origin. An "origin" is defined by the scheme (http/https), domain, and port. Without proper CORS headers, browsers will block requests from your frontend to the backend if they're not served from the same origin.

## Why We're Seeing CORS Errors

The current implementation of the backend API doesn't include CORS headers, which causes browsers to block requests from the frontend when they're served from different origins (e.g., when the frontend is running locally at http://localhost:5500 and trying to access the backend at https://apibackend.adult-webcam-faq.com).

## Solution: Implementing CORS

We've provided a CORS patch file (`cors-patch.js`) that wraps the original handler and adds the necessary CORS headers to all responses.

### Using the CORS Patch

To implement CORS in your backend, you have two options:

#### Option 1: Modify the index.js file directly (simplest)

1. Open `src/index.js`
2. Add the following code at the top of the file (after any imports):

```javascript
// Add CORS headers to all responses
function handleCorsHeaders(request, response) {
  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  };
  
  // Create a new response with CORS headers
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
```

3. Then modify the `fetch` method in the `export default` object to handle CORS preflight requests and add CORS headers to all responses:

```javascript
export default {
  async fetch(request, env) {
    console.log('Request received:', request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204, // No content
        headers: {
          'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
          'Access-Control-Max-Age': '86400', // 24 hours
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    const url = new URL(request.url);

    // Rest of your handler code...
    
    // For the get-session-key endpoint
    if (url.pathname === '/api/get-session-key' && request.method === 'POST') {
      try {
        // Your existing code...
        
        // Add CORS headers to the response
        return handleCorsHeaders(
          request,
          new Response(
            JSON.stringify({ sessionKey, expiresAt: new Date(timestamp).toISOString() }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      } catch (error) {
        // Your existing error handling...
        return handleCorsHeaders(
          request,
          new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
    }

    // For the generate-prompt endpoint
    if (url.pathname === '/api/generate-prompt' && request.method === 'POST') {
      try {
        // Your existing code...
        
        // Add CORS headers to the response
        return handleCorsHeaders(
          request,
          new Response(JSON.stringify(structuredResponse), {
            headers: { 'Content-Type': 'application/json' },
          })
        );
      } catch (error) {
        // Your existing error handling...
        return handleCorsHeaders(
          request,
          new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
    }

    // Default 404 response
    return handleCorsHeaders(
      request,
      new Response('Not Found', { status: 404 })
    );
  },
};
```

#### Option 2: Using the CORS Patch as a Wrapper (more modular)

1. Place the `cors-patch.js` file in the `backend` directory
2. Update your `wrangler.toml` file to use the CORS patch as the main entry point:

```toml
# Update the entry point to use the CORS patch
main = "./cors-patch.js"
```

3. Deploy your worker using the updated configuration:

```bash
npx wrangler deploy
```

## Testing CORS

After implementing one of the solutions above, you can test if CORS is working properly by:

1. Running the frontend locally (e.g., at http://localhost:5500)
2. Opening the browser's developer tools (F12 or Ctrl+Shift+I / Cmd+Opt+I)
3. Going to the Network tab
4. Clicking the "Test API Connection" button in the frontend
5. Verifying that the requests to the backend succeed without CORS errors

## Allowed Origins

The current implementation allows requests from any origin (`*`). In production, you might want to restrict this to specific domains. To do so, modify the `getCorsHeaders` function to only allow specific origins:

```javascript
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://your-production-domain.com',
    'http://localhost:5500',
    'http://localhost:3000',
    // Add any other domains you want to allow
  ];
  
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  });
  
  // Only set the Access-Control-Allow-Origin header if the origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  
  return headers;
}
```

## Security Considerations

- Be cautious with `Access-Control-Allow-Credentials: true` - this allows cookies and authentication to be sent with cross-origin requests, which could pose security risks if not handled properly
- Consider restricting the allowed origins to only the domains you trust
- Regularly review and update your CORS configuration as your application evolves
