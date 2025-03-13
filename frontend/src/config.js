// Configuration handling for Broadcasting Real-Time Coach

// App State - Configuration related
const configState = {
    config: {
        openRouterApiKey: '',
        aiModel: 'anthropic/claude-instant-v1',
        broadcasterName: '',
        promptLanguage: 'en-US',
        promptDelay: 5,
        preferences: ''
    }
};

// DOM Elements
let configToggle;
let configSection;
let saveConfigBtn;
let apiTestResult;

// Initialize configuration module
function initConfig() {
    // Get DOM elements
    configToggle = document.getElementById('configToggle');
    configSection = document.getElementById('configSection');
    saveConfigBtn = document.getElementById('saveConfig');
    
    // Add event listeners
    configToggle.addEventListener('click', toggleConfig);
    saveConfigBtn.addEventListener('click', saveConfig);
    document.getElementById('testApiConnection').addEventListener('click', testApiConnection);
    
    // Load saved configuration
    loadConfig();
}

// Load saved configuration from localStorage
function loadConfig() {
    const savedConfig = localStorage.getItem('chatCoachConfig');
    if (savedConfig) {
        try {
            const parsedConfig = JSON.parse(savedConfig);
            configState.config = { ...configState.config, ...parsedConfig };
            
            // Populate form fields
            document.getElementById('openRouterApiKey').value = configState.config.openRouterApiKey || '';
            document.getElementById('aiModel').value = configState.config.aiModel || 'anthropic/claude-instant-v1';
            document.getElementById('broadcasterName').value = configState.config.broadcasterName || '';
            document.getElementById('promptLanguage').value = configState.config.promptLanguage || 'en-US';
            document.getElementById('promptDelay').value = configState.config.promptDelay || 5;
            document.getElementById('preferences').value = configState.config.preferences || '';
        } catch (error) {
            console.error('Error loading saved configuration:', error);
        }
    }
    
    // Return the loaded config
    return configState.config;
}

// Save configuration to localStorage
function saveConfig() {
    configState.config.openRouterApiKey = document.getElementById('openRouterApiKey').value;
    configState.config.aiModel = document.getElementById('aiModel').value;
    configState.config.broadcasterName = document.getElementById('broadcasterName').value;
    configState.config.promptLanguage = document.getElementById('promptLanguage').value;
    configState.config.promptDelay = parseInt(document.getElementById('promptDelay').value) || 5;
    configState.config.preferences = document.getElementById('preferences').value;

    localStorage.setItem('chatCoachConfig', JSON.stringify(configState.config));
    addActivityItem('Configuration saved', 'event');
    configSection.classList.add('hidden');
    
    // Return the updated config
    return configState.config;
}

// Toggle configuration section visibility
function toggleConfig() {
    configSection.classList.toggle('hidden');
}

// Test OpenRouter API connection
async function testApiConnection() {
    apiTestResult = document.getElementById('apiTestResult');
    apiTestResult.classList.remove('hidden');
    apiTestResult.style.backgroundColor = '#f8f9fa';
    apiTestResult.textContent = 'Testing API connection...';
    
    // Get current values from form (not saved config)
    const apiKey = document.getElementById('openRouterApiKey').value;
    const model = document.getElementById('aiModel').value;
    
    if (!apiKey || apiKey.trim() === '') {
        apiTestResult.style.backgroundColor = '#f8d7da';
        apiTestResult.textContent = 'Error: API key is missing. Please enter your OpenRouter API key.';
        return;
    }
    
    try {
        console.log('DEBUG - Testing OpenRouter API connection');
        console.log('DEBUG - Using model:', model);
        
        // Simple test request
        const testBody = {
            model: model,
            messages: [
                { role: 'user', content: 'Hello, this is a test message. Please respond with "API connection successful".' }
            ],
            max_tokens: 20
        };
        
        console.log('DEBUG - Test request body:', JSON.stringify(testBody, null, 2));
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Broadcasting Real-Time Coach'
            },
            body: JSON.stringify(testBody)
        });
        
        console.log('DEBUG - Test response status:', response.status);
        
        const responseClone = response.clone();
        const responseText = await responseClone.text();
        console.log('DEBUG - Test response body:', responseText);
        
        if (!response.ok) {
            let errorMessage = `API error: ${response.status}`;
            
            try {
                const errorJson = JSON.parse(responseText);
                if (errorJson.error && errorJson.error.message) {
                    errorMessage = `Error: ${errorJson.error.message}`;
                }
            } catch (e) {
                // If we can't parse the error as JSON, just use the status code
            }
            
            apiTestResult.style.backgroundColor = '#f8d7da';
            apiTestResult.textContent = errorMessage;
            return;
        }
        
        // Success!
        apiTestResult.style.backgroundColor = '#d4edda';
        apiTestResult.textContent = 'Success! API connection is working correctly.';
        
    } catch (error) {
        console.error('DEBUG - Test API connection error:', error);
        apiTestResult.style.backgroundColor = '#f8d7da';
        apiTestResult.textContent = `Error: ${error.message}`;
    }
}

// Export functions and state
export { 
    initConfig, 
    loadConfig, 
    saveConfig, 
    toggleConfig, 
    testApiConnection, 
    configState 
};
