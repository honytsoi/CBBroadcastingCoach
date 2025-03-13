const promptTemplate = `
You are a real-time coach for a Chaturbate broadcaster named {{broadcaster}}. 
Your job is to provide short, actionable suggestions that the broadcaster can hear through an earpod while streaming.

Recent events in the chat room:
{{context}}

Broadcaster preferences/restrictions: {{preferences}}

Based on this context, provide ONE brief coaching suggestion (max 15 words) that the broadcaster can say or do right now to better engage with viewers. 
Make it conversational, natural, and easy to say. Focus on being helpful without being verbose.
When you are referencing peoples names don't read out the special symbols or numbers, for example "john_doe" should just be refered to as "John" aod "Mary1999TX" would just be "Mary"; try to work out a reasonable spoken name.
"mr_south" is "Mister South" and so on.
Give the broadcaster suggestions of things to say that will be open ended and help the coverstation move forward.
Your response should ONLY include the exact words the broadcaster should say or a very brief action to take.

The response should be in JSON format, containing an "action" key (the suggestion for the broadcaster) and a "content" key (the full text of the suggestion).

For Example of saying something:

{
  "action": "say",
  "content": "John, that sounds great, what would you like to do next?"
}


For example of doing something: 

{
  "action": "do",
  "content": "Turn around briefly so the viewers can see your outfit"
}

`;


// Simple native JavaScript hashing function
function simpleHash(input) {
	let hash = 0;
	if (input.length === 0) return hash.toString();
	for (let i = 0; i < input.length; i++) {
	  const char = input.charCodeAt(i);
	  hash = (hash << 5) - hash + char; // Bitwise operations to create a hash
	  hash |= 0; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(16); // Return as a hexadecimal string
  }
  
  function generateSessionKey(broadcasterName) {
	const salt = 'your-secret-salt'; // Replace with a secure salt or store in environment variables
	const timestamp = new Date().toISOString(); // Use ISO string for consistency
  
	// Generate the hash using the simpleHash function
	const hash = simpleHash(`${broadcasterName}:${timestamp}:${salt}`);
	return { sessionKey: `${hash}|${timestamp}`, timestamp }; // Use '|' as the separator
  }
  
  function validateSessionKey(sessionKey, broadcasterName) {
	if (!sessionKey || !broadcasterName) return false;
  
	const [hash, timestamp] = sessionKey.split('|');
	if (!hash || !timestamp) return false;
  
	const sessionDate = new Date(timestamp);
	if (isNaN(sessionDate.getTime())) {
	  console.error('Invalid timestamp:', timestamp);
	  return false;
	}
  
	const now = new Date();
	const diffInHours = (now - sessionDate) / (1000 * 60 * 60);
  
	if (diffInHours > 24) return false;
  
	const salt = 'your-secret-salt';
	const expectedHash = simpleHash(`${broadcasterName}:${timestamp}:${salt}`);
	return hash === expectedHash;
  }
  
  export default {
	async fetch(request, env) {
	  console.log('Request received:', request.url);
      
      // For non-POST requests, fallback to static assets
      if (request.method !== 'POST') {
        return env.ASSETS.fetch(request);
      }
  
	  const url = new URL(request.url);
  
	  // New endpoint to get a session key
	  if (url.pathname === '/api/get-session-key' && request.method === 'POST') {
		try {
		  const requestBody = await request.json();
		  const { username, broadcaster } = requestBody;
  
		  // Validate the request body
		  if (!username || !broadcaster) {
			return new Response(
			  JSON.stringify({ error: 'Missing username or broadcaster name' }),
			  { status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		  }
  
		  // Generate a session key
		  const { sessionKey, timestamp } = generateSessionKey(broadcaster);
  
		  return new Response(
			JSON.stringify({ sessionKey, expiresAt: new Date(timestamp).toISOString() }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		  );
		} catch (error) {
		  console.error('Error in /api/get-session-key:', error.message);
		  return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		  });
		}
	  }
  
	  // Existing endpoint for generating prompts
	  if (url.pathname === '/api/generate-prompt' && request.method === 'POST') {
		try {
		  console.log('Parsing request body...');
		  const requestBody = await request.json();
		  console.log('Parsed request body:', requestBody);
  
		  const { context, broadcaster, preferences, aimodel, sessionKey } = requestBody;
  
		  // Validate the request body fields
		  if (!Array.isArray(context) || context.length === 0) {
			console.error('Invalid or missing context');
			return new Response(JSON.stringify({ error: 'Invalid or missing context' }), {
			  status: 400,
			  headers: { 'Content-Type': 'application/json' },
			});
		  }
  
		  if (!broadcaster || typeof broadcaster !== 'string' || broadcaster.trim() === '') {
			console.error('Invalid or missing broadcaster');
			return new Response(JSON.stringify({ error: 'Invalid or missing broadcaster' }), {
			  status: 400,
			  headers: { 'Content-Type': 'application/json' },
			});
		  }
  
		  // Validate the session key
		  if (!validateSessionKey(sessionKey, broadcaster)) {
			console.error('Invalid or missing session key');
			return new Response(JSON.stringify({ error: 'Invalid or missing session key' }), {
			  status: 401,
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
  
		  // Generate a new session key to refresh it
		  const { sessionKey: newSessionKey, timestamp } = generateSessionKey(broadcaster);
  
		  // Add the new session key to the response
		  structuredResponse.sessionKey = newSessionKey;
		  structuredResponse.expiresAt = new Date(timestamp).toISOString();
  
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
