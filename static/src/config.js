// Configuration handling for Broadcasting Real-Time Coach

// App State - Configuration related
const configState = {
    config: {
        aiModel: 'anthropic/claude-instant-v1',
        broadcasterName: '',
        promptLanguage: 'en-US',
        promptDelay: 5,
        preferences: ''
    },
    sessionKey: null,
    sessionKeyExpires: null
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

// Test backend API connection
// The test button is working
async function testApiConnection() {
    // Initialize UI elements
    apiTestResult = document.getElementById('apiTestResult');
    apiTestResult.classList.remove('hidden');
    apiTestResult.style.backgroundColor = '#f8f9fa';
    apiTestResult.textContent = 'Testing API connection...';

    
    try {
        // Step 1: Get Session Key
        const sessionResponse = await fetch(`/api/get-session-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'test_user',
                broadcaster: configState.config.broadcasterName || 'test_broadcaster'
            })
        });

        const sessionData = await sessionResponse.json();
        const sessionKey = sessionData.sessionKey;
        const expiresAt = sessionData.expiresAt;

        if (!sessionKey || !expiresAt) {
            throw new Error('Invalid session key response');
        }

        // Step 2: Test Generate Prompt
        const testContext = [{
            type: 'chat',
            text: 'test_user says hello!',
            timestamp: new Date().toISOString()
        }];

        const promptResponse = await fetch(`/api/generate-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: testContext,
                broadcaster: configState.config.broadcasterName || 'test_broadcaster',
                preferences: configState.config.preferences,
                sessionKey: sessionKey
            })
        });

        const promptData = await promptResponse.json();
        if (!promptData.action || !promptData.content) {
            throw new Error('Invalid prompt response');
        }

        // Update UI with success
        apiTestResult.style.backgroundColor = '#d4edda';
        apiTestResult.textContent = 'API connection test successful!';
        apiTestResult.innerHTML += `
            <div class="test-details">
                <p>Session Key: ${sessionKey}</p>
                <p>Expires At: ${expiresAt}</p>
                <p>Action: ${promptData.action}</p>
                <p>Content: ${promptData.content}</p>
            </div>
        `;

    } catch (error) {
        // Handle errors
        apiTestResult.style.backgroundColor = '#f8d7da';
        apiTestResult.textContent = `Error: ${error.message}`;
        console.error('API Test Error:', error);
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
