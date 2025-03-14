// src/api/cloudflareWorker.js
const AI_API_ENDPOINT = '/api/generate-prompt'; // Relative URL!
const SESSION_KEY_ENDPOINT = '/api/get-session-key'; // Session key endpoint

let aiState = {
    isGeneratingPrompt: false,
};

// Initialize or refresh session key
async function getSessionKey(username, broadcaster) {
    try {
        const response = await fetch(SESSION_KEY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username || 'anonymous',
                broadcaster: broadcaster || 'anonymous'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            sessionKey: data.sessionKey,
            expiresAt: data.expiresAt
        };
    } catch (error) {
        console.error('Error getting session key:', error);
        throw error;
    }
}

// Load session data from localStorage
function loadSessionData() {
    try {
        const sessionData = localStorage.getItem('chatCoachSession');
        if (!sessionData) return null;
        
        const data = JSON.parse(sessionData);
        // Check if the session is expired
        if (new Date(data.expiresAt) < new Date()) {
            localStorage.removeItem('chatCoachSession');
            return null;
        }
        return data;
    } catch (error) {
        console.error('Error loading session data:', error);
        return null;
    }
}

// Save session data to localStorage
function saveSessionData(sessionKey, expiresAt) {
    try {
        const sessionData = {
            sessionKey,
            expiresAt
        };
        localStorage.setItem('chatCoachSession', JSON.stringify(sessionData));
    } catch (error) {
        console.error('Error saving session data:', error);
    }
}

async function generateCoachingPrompt(config, context, onPromptGenerated) {
    // debugging
    console.log('generateCoachingPrompt', config, context);
    if (context.length === 0 || aiState.isGeneratingPrompt) return;

    aiState.isGeneratingPrompt = true;
    try {
        // Ensure we have a valid session key
        let sessionKey = config.sessionKey;
        
        // If no session key in config, try to load from localStorage
        if (!sessionKey) {
            const sessionData = loadSessionData();
            if (sessionData) {
                sessionKey = sessionData.sessionKey;
            } else {
                // If no valid session in localStorage, get a new one
                const { sessionKey: newKey, expiresAt } = await getSessionKey(
                    'user', // You might want to pass a real username here
                    config.broadcasterName
                );
                sessionKey = newKey;
                // Update config with the new session key
                config.sessionKey = sessionKey;
                // Save to localStorage
                saveSessionData(sessionKey, expiresAt);
            }
        }

        // Format context as expected by the backend (array of objects)
        const contextArray = context.map(item => ({
            type: item.type,
            text: item.text,
            timestamp: item.timestamp || new Date().toISOString()
        }));

        const response = await fetch(AI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: contextArray,
                broadcaster: config.broadcasterName,
                preferences: config.preferences,
                sessionKey: sessionKey
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Store the new session key if it's provided in the response
        if (data.sessionKey && data.expiresAt) {
            config.sessionKey = data.sessionKey;
            saveSessionData(data.sessionKey, data.expiresAt);
        }
        
        const suggestion = data.content.trim();

        if (onPromptGenerated && typeof onPromptGenerated === 'function') {
            onPromptGenerated(suggestion);
        }

        return suggestion;
    } catch (error) {
        console.error('Error generating coaching prompt:', error);
        window.addActivityItem(`Error generating prompt: ${error.message}`, 'event');
        return null;
    } finally {
        aiState.isGeneratingPrompt = false;
    }
}

export default {
    generateCoachingPrompt,
    getSessionKey,
    loadSessionData,
    saveSessionData
};
