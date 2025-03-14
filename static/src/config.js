// Configuration handling for Broadcasting Real-Time Coach
import CloudflareWorkerAPI from './api/cloudflareWorker.js';

// App State - Configuration related
const configState = {
    config: {
        aiModel: 'anthropic/claude-instant-v1',
        broadcasterName: '',
        promptLanguage: 'en-US',
        promptDelay: 5,
        preferences: '',
        sessionKey: null,
        scannedUrl: '' // New field to store scanned QR code URL
    }
};

// DOM Elements
let configToggle;
let configSection;
let saveConfigBtn;
let apiTestResult;

// Initialize configuration module
async function initConfig() {
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
    
    // Try to load session key from localStorage
    const sessionData = CloudflareWorkerAPI.loadSessionData();
    if (sessionData) {
        configState.config.sessionKey = sessionData.sessionKey;
    } else if (configState.config.broadcasterName) {
        // If we have a broadcaster name but no session, try to get a new session key
        try {
            const { sessionKey, expiresAt } = await CloudflareWorkerAPI.getSessionKey(
                'user', // Default username
                configState.config.broadcasterName
            );
            configState.config.sessionKey = sessionKey;
            CloudflareWorkerAPI.saveSessionData(sessionKey, expiresAt);
        } catch (error) {
            console.error('Error getting session key during init:', error);
        }
    }
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
            document.getElementById('scannedUrl').value = configState.config.scannedUrl || '';
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
async function saveConfig() {
    configState.config.aiModel = document.getElementById('aiModel').value;
    configState.config.scannedUrl = document.getElementById('scannedUrl').value;
    configState.config.broadcasterName = document.getElementById('broadcasterName').value;
    configState.config.promptLanguage = document.getElementById('promptLanguage').value;
    configState.config.promptDelay = parseInt(document.getElementById('promptDelay').value) || 5;
    configState.config.preferences = document.getElementById('preferences').value;

    // Get a fresh session key when saving config
    try {
        const { sessionKey, expiresAt } = await CloudflareWorkerAPI.getSessionKey(
            'user', // Default username
            configState.config.broadcasterName
        );
        configState.config.sessionKey = sessionKey;
        CloudflareWorkerAPI.saveSessionData(sessionKey, expiresAt);
    } catch (error) {
        console.error('Error getting session key during save:', error);
        window.addActivityItem('Error refreshing session key, but configuration saved', 'event');
    }

    localStorage.setItem('chatCoachConfig', JSON.stringify(configState.config));
    window.addActivityItem('Configuration saved', 'event');
    configSection.classList.add('hidden');
    
    // Return the updated config
    return configState.config;
}

// Toggle configuration section visibility
function toggleConfig() {
    configSection.classList.toggle('hidden');
}

// Test backend API connection
async function testApiConnection() {
    // Initialize UI elements
    apiTestResult = document.getElementById('apiTestResult');
    apiTestResult.classList.remove('hidden');
    apiTestResult.style.backgroundColor = '#f8f9fa';
    apiTestResult.textContent = 'Testing API connection...';

    try {
        // Step 1: Get Session Key using our CloudflareWorkerAPI
        const { sessionKey, expiresAt } = await CloudflareWorkerAPI.getSessionKey(
            'test_user',
            configState.config.broadcasterName || 'test_broadcaster'
        );

        if (!sessionKey || !expiresAt) {
            throw new Error('Invalid session key response');
        }

        // Update the config with this session key
        configState.config.sessionKey = sessionKey;
        CloudflareWorkerAPI.saveSessionData(sessionKey, expiresAt);

        // Step 2: Test Generate Prompt
        const testContext = [{
            type: 'chat',
            text: 'test_user says hello!',
            timestamp: new Date().toISOString()
        }];

        // Use current config with our new session key
        const result = await CloudflareWorkerAPI.generateCoachingPrompt(
            configState.config,
            testContext,
            null // No callback needed for test
        );

        if (!result) {
            throw new Error('Failed to generate prompt');
        }

        // Update UI with success
        apiTestResult.style.backgroundColor = '#d4edda';
        apiTestResult.textContent = 'API connection test successful!';
        apiTestResult.innerHTML += `
            <div class="test-details">
                <p>Session Key: ${sessionKey}</p>
                <p>Expires At: ${expiresAt}</p>
                <p>Test Result: ${result}</p>
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
