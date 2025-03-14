// Configuration handling for Broadcasting Real-Time Coach
import CloudflareWorkerAPI from './api/cloudflareWorker.js';
import UserManager from './user-manager.js';

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
    },
    
    // Method to update config
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem('chatCoachConfig', JSON.stringify(this.config));
        return this.config;
    }
};

// DOM Elements
let configToggle;
let configSection;
let saveConfigBtn;
let apiTestResult;
let userManager;

// Initialize configuration module
async function initConfig() {
    // Get DOM elements
    configToggle = document.getElementById('configToggle');
    configSection = document.getElementById('configSection');
    saveConfigBtn = document.getElementById('saveConfig');
    
    // Initialize UserManager if it doesn't exist in window
    if (!window.userManager) {
        window.userManager = new UserManager();
    }
    userManager = window.userManager;
    
    // Add event listeners
    configToggle.addEventListener('click', toggleConfig);
    saveConfigBtn.addEventListener('click', saveConfig);
    document.getElementById('testApiConnection').addEventListener('click', testApiConnection);
    
    // Add data export/import UI
    addDataManagementUI();
    
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

/**
 * Add data management UI elements
 */
function addDataManagementUI() {
    // Create data management section
    const settingsSection = document.getElementById('configSection');
    const dataSection = document.createElement('div');
    dataSection.className = 'settings-group';
    dataSection.innerHTML = `
        <h3>Data Management</h3>
        <div class="settings-row">
            <label>Import/Export Data:</label>
            <div class="button-group">
                <button id="exportData" class="action-button">Export Data</button>
                <button id="importData" class="action-button">Import Data</button>
            </div>
        </div>
        <div class="settings-row hidden" id="importOptions">
            <label>Import Options:</label>
            <div class="checkbox-group">
                <input type="checkbox" id="mergeData" name="mergeData">
                <label for="mergeData">Merge with existing data</label>
            </div>
        </div>
        <div id="dataManagementResult" class="result-box hidden"></div>
    `;
    
    // Add the data section to the settings section
    settingsSection.appendChild(dataSection);
    
    // Get DOM elements
    const exportButton = document.getElementById('exportData');
    const importButton = document.getElementById('importData');
    const dataResult = document.getElementById('dataManagementResult');
    const importOptions = document.getElementById('importOptions');
    const mergeCheckbox = document.getElementById('mergeData');
    
    // Add event listeners
    exportButton.addEventListener('click', () => {
        try {
            const blob = new Blob([userManager.exportData(configState.config)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `broadcasting-coach-data-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            
            // Show success message
            dataResult.textContent = 'Data exported successfully!';
            dataResult.style.backgroundColor = '#d4edda';
            dataResult.classList.remove('hidden');
            
            // Hide after 3 seconds
            setTimeout(() => {
                dataResult.classList.add('hidden');
            }, 3000);
        } catch (error) {
            // Show error message
            dataResult.textContent = `Export failed: ${error.message}`;
            dataResult.style.backgroundColor = '#f8d7da';
            dataResult.classList.remove('hidden');
        }
    });
    
    importButton.addEventListener('click', () => {
        // Toggle import options
        importOptions.classList.toggle('hidden');
        
        // Show file picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Check file size
            if (file.size > 10 * 1024 * 1024) {
                dataResult.textContent = 'File size exceeds 10MB limit';
                dataResult.style.backgroundColor = '#f8d7da';
                dataResult.classList.remove('hidden');
                return;
            }
            
            // Read file
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    // Get file content
                    const fileContent = event.target.result;
                    
                    // Confirm import
                    if (confirm('This will replace your current data. Are you sure you want to proceed?')) {
                        // Import data
                        const mergeMode = mergeCheckbox.checked;
                        const result = userManager.importData(fileContent, configState, mergeMode);
                        
                        if (result.success) {
                            // Show success message
                            dataResult.textContent = result.message;
                            dataResult.style.backgroundColor = '#d4edda';
                            dataResult.classList.remove('hidden');
                            
                            // Reload page after short delay
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                        } else {
                            // Show error message
                            dataResult.textContent = result.message;
                            dataResult.style.backgroundColor = '#f8d7da';
                            dataResult.classList.remove('hidden');
                        }
                    }
                } catch (error) {
                    // Show error message
                    dataResult.textContent = `Import failed: ${error.message}`;
                    dataResult.style.backgroundColor = '#f8d7da';
                    dataResult.classList.remove('hidden');
                }
            };
            
            reader.onerror = () => {
                dataResult.textContent = 'Error reading file';
                dataResult.style.backgroundColor = '#f8d7da';
                dataResult.classList.remove('hidden');
            };
            
            reader.readAsText(file);
        });
        
        input.click();
    });
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
