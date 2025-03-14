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

/**
 * Create or get the error display element
 */
function getOrCreateErrorDisplay() {
    let errorDisplay = document.getElementById('errorDisplay');
    
    if (!errorDisplay) {
        errorDisplay = document.createElement('div');
        errorDisplay.id = 'errorDisplay';
        errorDisplay.style.position = 'fixed';
        errorDisplay.style.bottom = '20px';
        errorDisplay.style.right = '20px';
        errorDisplay.style.padding = '15px';
        errorDisplay.style.backgroundColor = '#ffebee';
        errorDisplay.style.border = '1px solid #ffcdd2';
        errorDisplay.style.borderRadius = '4px';
        errorDisplay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        errorDisplay.style.zIndex = '1000';
        errorDisplay.style.display = 'none';
        errorDisplay.style.maxWidth = '400px';
        errorDisplay.style.wordWrap = 'break-word';
        document.body.appendChild(errorDisplay);
    }
    
    return errorDisplay;
}

/**
 * Display an error message on the screen
 */
function displayError(error) {
    const errorDisplay = getOrCreateErrorDisplay();
    const isQuotaError = error.message.toLowerCase().includes('quota') || 
                         error.message.toLowerCase().includes('limit') ||
                         error.message.toLowerCase().includes('exceeded');
    
    // Set title based on error type
    let errorTitle = 'Error';
    if (isQuotaError) {
        errorTitle = 'Quota Exceeded Error';
        errorDisplay.style.backgroundColor = '#fff3cd';
        errorDisplay.style.borderColor = '#ffecb5';
    } else {
        errorDisplay.style.backgroundColor = '#ffebee';
        errorDisplay.style.borderColor = '#ffcdd2';
    }
    
    // Build error message HTML
    errorDisplay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">${errorTitle}</div>
        <div>${error.message}</div>
        <div style="text-align: right; margin-top: 10px;">
            <button onclick="document.getElementById('errorDisplay').style.display='none'" 
                    style="padding: 5px 10px; background: #f1f1f1; border: none; border-radius: 3px; cursor: pointer;">
                Dismiss
            </button>
        </div>
    `;
    
    errorDisplay.style.display = 'block';
    
    // Auto-hide after 20 seconds if it's not a quota error
    if (!isQuotaError) {
        setTimeout(() => {
            if (errorDisplay) {
                errorDisplay.style.display = 'none';
            }
        }, 20000);
    }
}

async function generateCoachingPrompt(config, context, onPromptGenerated) {
    // debugging
    console.log('generateCoachingPrompt', config, context);
    if (context.length === 0 || aiState.isGeneratingPrompt) return;

    aiState.isGeneratingPrompt = true;
    try {
        // Validate the AI model
        const APPROVED_MODELS = ['@cf/meta/llama-3.2-1b-instruct'];
        if (!APPROVED_MODELS.includes(config.aiModel)) {
            throw new Error(`AI model ${config.aiModel} is not approved. Only @cf/meta/llama-3.2-1b-instruct is currently supported.`);
        }
        
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
                aimodel: config.aiModel,  // Pass AI model to backend
                sessionKey: sessionKey
            })
        });

        // Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
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
        
        // Display error on screen
        displayError(error);
        
        // Add to activity feed
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
