/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
	  const pathname = url.pathname;
  
	  if (pathname === '/api/generate-prompt') {
		const requestBody = await request.json();
		
		// Extract context from the request body
		const { context } = requestBody;
  
		// Prepare the prompt for the AI model
		const formattedContext = context.map(item => `${item.type}: ${item.text}`).join('\n');
		const prompt = `Given the following chat history:\n${formattedContext}\n\nWhat should the broadcaster say or do next?`;
  
		try {
		  // Run inference using the first model
		  const responseLlama = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
			prompt: prompt,
		  });
  
		  // Run inference using the second model
		  const responseMistral = await env.AI.run("@hf/mistral/mistral-7b-instruct-v0.2", {
			prompt: prompt,
		  });
  
		  return new Response(JSON.stringify({
			llamaResponse: responseLlama.response,
			mistralResponse: responseMistral.response
		  }), {
			headers: { 'Content-Type': 'application/json' },
		  });
		} catch (error) {
		  return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		  });
		}
	  }
  
	  return new Response('Not Found', { status: 404 });
	},
  };