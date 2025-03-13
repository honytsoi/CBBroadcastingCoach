// Import the prompt template as a string
import promptTemplate from './promptTemplate.txt';

export default {
	async fetch(request, env) {
	  console.log('Request received:', request.url);
  
	  const url = new URL(request.url);
	  if (url.pathname === '/api/generate-prompt' && request.method === 'POST') {
		try {
		  console.log('Parsing request body...');
		  const requestBody = await request.json();
		  console.log('Parsed request body:', requestBody);
  
		  const { context, broadcaster, preferences, aimodel } = requestBody;
  
		  // Validate the request body
		  if (!Array.isArray(context) || context.length === 0) {
			console.error('Invalid or missing context');
			return new Response(JSON.stringify({ error: 'Invalid or missing context' }), {
			  status: 400,
			  headers: { 'Content-Type': 'application/json' },
			});
		  }
  
		  console.log('Preparing prompt template...');
		  const model = aimodel || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
		  console.log('Using AI model:', model);
  
		  const formattedContext = context
			.map(item => `${item.type}: ${item.text} (${new Date(item.timestamp).toLocaleString()})`)
			.join('\n');
  
		  console.log('Formatted context:', formattedContext);
  
		  const finalPrompt = promptTemplate
			.replace('{{context}}', formattedContext)
			.replace('{{broadcaster}}', broadcaster || 'Unknown Broadcaster')
			.replace('{{preferences}}', preferences || 'No preferences specified');
  
		  console.log('Final prompt:', finalPrompt);
  
		  console.log('Running AI inference...');
		  const aiResponse = await env.AI.run(model, {
			prompt: finalPrompt,
		  });
  
		  console.log('AI response:', aiResponse);
  
		  const parseResponse = (response) => {
			try {
			  const parsed = JSON.parse(response.response);
			  return {
				action: parsed.action || 'unknown',
				content: parsed.content || 'No suggestion available.',
			  };
			} catch (error) {
			  console.error('Error parsing AI response:', error);
			  return {
				action: 'unknown',
				content: 'Error parsing AI response.',
			  };
			}
		  };
  
		  const structuredResponse = parseResponse(aiResponse);
		  console.log('Structured response:', structuredResponse);
  
		  return new Response(JSON.stringify(structuredResponse), {
			headers: { 'Content-Type': 'application/json' },
		  });
		} catch (error) {
		  console.error('Error in /api/generate-prompt:', error.message);
		  return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		  });
		}
	  }
  
	  return new Response('Not Found', { status: 404 });
	},
  };