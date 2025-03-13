// OpenRouter API Module for Broadcasting Real-Time Coach

// State related to AI prompt generation
const aiState = {
    isGeneratingPrompt: false
};

// Generate coaching prompt using OpenRouter API
async function generateCoachingPrompt(config, context, onPromptGenerated) {
    if (!config.openRouterApiKey || context.length === 0 || aiState.isGeneratingPrompt) return;
    
    // Set lock to prevent multiple simultaneous API calls
    aiState.isGeneratingPrompt = true;
    
    try {
        // Prepare context for the AI
        const recentEvents = context
            .map(item => {
                if (item.type === 'chat') {
                    return `Chat: ${item.text}`;
                } else if (item.type === 'tip') {
                    return `Tip: ${item.text}`;
                } else {
                    return `Event: ${item.text}`;
                }
            })
            .join('\n');
        
        // Prepare preferences/restrictions
        const preferences = config.preferences 
            ? `\nBroadcaster preferences/restrictions: ${config.preferences}`
            : '';
        
        // Create the prompt for the AI
        const prompt = `You are a real-time coach for a Chaturbate broadcaster named ${config.broadcasterName}. 
Your job is to provide short, actionable suggestions that the broadcaster can hear through an earpod while streaming.

Recent events in the chat room:
${recentEvents}
${preferences}

Based on this context, provide ONE brief coaching suggestion (max 15 words) that the broadcaster can say or do right now to better engage with viewers. 
Make it conversational, natural, and easy to say. Focus on being helpful without being verbose.
When you are referencing peoples names don't read out the special symbols or numbers, for example "john_doe" should just be refered to as "John" aod "Mary1999TX" would just be "Mary"; try to work out a reasonable spoken name.
"mr_south" is "Mister South" and so on.
Give the broadcaster suggestions of things to say that will be open ended and help the coverstation move forward.
Your response should ONLY include the exact words the broadcaster should say or a very brief action to take.`;

        // Check API key format
        if (!config.openRouterApiKey || config.openRouterApiKey.trim() === '') {
            console.log('DEBUG - ERROR: API key is missing or empty');
            throw new Error('API key is missing. Please add your OpenRouter API key in the settings.');
        }
        
        if (!config.openRouterApiKey.startsWith('sk-')) {
            console.log('DEBUG - WARNING: API key does not start with "sk-", which is the expected format for OpenRouter API keys');
        }
        
        // Check model format
        console.log('DEBUG - Checking model format:', config.aiModel);
        // OpenRouter typically expects models in format like "openai/gpt-4o" or "anthropic/claude-3.7-sonnet"
        if (!config.aiModel.includes('/')) {
            console.log('DEBUG - WARNING: Model format may be incorrect. OpenRouter typically expects format like "provider/model-name"');
        }
        
        // Debug: Log request data before sending
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openRouterApiKey ? '****' + config.openRouterApiKey.slice(-6) : 'missing'}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'CB Broadcasting Real-Time Coach'
        };
        
        const requestBody = {
            model: config.aiModel,
            messages: [
                { role: 'system', content: 'You are a helpful, concise broadcasting coach.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 50
        };
        
        console.log('DEBUG - OpenRouter API Request:');
        console.log('URL:', 'https://openrouter.ai/api/v1/chat/completions');
        console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
        console.log('Body:', JSON.stringify(requestBody, null, 2));
        console.log('Selected Model:', config.aiModel);
        console.log('API Key (masked):', config.openRouterApiKey ? '****' + config.openRouterApiKey.slice(-6) : 'missing');
        
        // Call OpenRouter API
        console.log('DEBUG - Sending request to OpenRouter API...');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openRouterApiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Broadcasting Real-Time Coach'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('DEBUG - Response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()])
        });
        
        // Clone the response to read it twice (once for debugging, once for actual use)
        const responseClone = response.clone();
        
        try {
            // Try to parse the response as JSON for debugging
            const responseText = await responseClone.text();
            console.log('DEBUG - Response body:', responseText);
            
            // Try to parse as JSON to see if it's valid
            try {
                const responseJson = JSON.parse(responseText);
                console.log('DEBUG - Parsed JSON response:', responseJson);
                
                // Check for error messages in the response
                if (responseJson.error) {
                    console.log('DEBUG - API returned error object:', responseJson.error);
                }
            } catch (jsonError) {
                console.log('DEBUG - Response is not valid JSON:', jsonError.message);
            }
        } catch (textError) {
            console.log('DEBUG - Could not read response text:', textError.message);
        }
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        // Now use the original response for the actual processing
        const data = await response.json();
        const suggestion = data.choices[0].message.content.trim();
        
        // Call the callback with the suggestion
        if (onPromptGenerated && typeof onPromptGenerated === 'function') {
            onPromptGenerated(suggestion);
        }
        
        return suggestion;
        
    } catch (error) {
        console.error('Error generating coaching prompt:', error);
        window.addActivityItem(`Error generating prompt: ${error.message}`, 'event');
        return null;
    } finally {
        // Always release the lock, even if an error occurred
        aiState.isGeneratingPrompt = false;
    }
}

// Export functions and state
export {
    generateCoachingPrompt,
    aiState
};
