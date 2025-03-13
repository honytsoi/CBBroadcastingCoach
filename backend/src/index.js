/**
 * 
 * 
Request body:
```json
{
  "context": [
    {
      "text": "User123: Hello everyone!",
      "type": "chat",
      "timestamp": "2025-03-13T03:15:45.000Z"
    },
    {
      "text": "User456 tipped 50 tokens",
      "type": "tip",
      "timestamp": "2025-03-13T03:16:12.000Z"
    }
  ],
  "broadcaster": "BroadcasterName",
  "preferences": "Optional preferences or restrictions"
}
```

 */
export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
  
	  // Handle only POST requests to /api/generate-prompt
	  if (url.pathname === '/api/generate-prompt' && request.method === 'POST') {
		try {
		  // Parse the incoming request body
		  const requestBody = await request.json();
		  const { context } = requestBody;
  
		  // Validate the request body
		  if (!Array.isArray(context) || context.length === 0) {
			return new Response(JSON.stringify({ error: 'Invalid or missing context' }), {
			  status: 400,
			  headers: { 'Content-Type': 'application/json' },
			});
		  }
  
		  // Prepare the context for the AI model
		  const formattedContext = context
			.map(item => `${item.type}: ${item.text}`)
			.join('\n');
  
		  // Define the hardcoded prompt template
		  const promptTemplate = `
			Given the following chatroom activity:
			${formattedContext}
  
			Provide a suggestion for the broadcaster in JSON format:
			{
			  "action": "say" or "do",
			  "content": "What to say or do"
			}
		  `;
  
		  // Run inference using the first AI model
		  const aiResponseLlama = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
			prompt: promptTemplate,
		  });
  
		  // Run inference using the second AI model
		  const aiResponseMistral = await env.AI.run("@hf/mistral/mistral-7b-instruct-v0.2", {
			prompt: promptTemplate,
		  });
  
		  // Parse and structure the AI responses
		  const parseResponse = (response) => {
			try {
			  const parsed = JSON.parse(response.response);
			  return {
				action: parsed.action || 'unknown',
				content: parsed.content || 'No suggestion available.',
			  };
			} catch (error) {
			  return {
				action: 'unknown',
				content: 'Error parsing AI response.',
			  };
			}
		  };
  
		  const structuredResponse = {
			llama: parseResponse(aiResponseLlama),
			mistral: parseResponse(aiResponseMistral),
		  };
  
		  // Return the structured response
		  return new Response(JSON.stringify(structuredResponse), {
			headers: { 'Content-Type': 'application/json' },
		  });
  
		} catch (error) {
		  // Handle errors gracefully
		  return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		  });
		}
	  }
  
	  // Default response for unsupported routes/methods
	  return new Response('Not Found', { status: 404 });
	},
  };