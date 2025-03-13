// CORS patch for the backend
// This file contains the necessary modifications to enable CORS in the backend

export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest(request);
    }

    // Forward the request to the original handler
    try {
      // Import the original handler (this would be replaced with your actual import)
      const originalHandler = (await import('./src/index.js')).default;
      
      // Get response from the original handler
      const response = await originalHandler.fetch(request, env);
      
      // Add CORS headers to the response
      return addCorsHeaders(response, request);
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: getCorsHeaders(request),
      });
    }
  }
};

// Handle CORS preflight requests
function handleCorsPreflightRequest(request) {
  // Return a new response with CORS headers
  return new Response(null, {
    status: 204, // No content
    headers: getCorsHeaders(request),
  });
}

// Add CORS headers to an existing response
function addCorsHeaders(response, request) {
  // Get the existing headers
  const headers = new Headers(response.headers);
  
  // Add CORS headers
  const corsHeaders = getCorsHeaders(request);
  corsHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  
  // Return a new response with the combined headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Get CORS headers based on request origin
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  });
  
  return corsHeaders;
}
