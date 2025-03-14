// Configuration handling for Broadcasting Real-Time Coach
import CloudflareWorkerAPI from './api/cloudflareWorker.js';
import UserManager from './user-manager.js';

// App State - Configuration related
const configState = {
    config: {
        aiModel: '@cf/meta/llama-3.2-1b-instruct',
        broadcasterName: '',
        promptLanguage: 'en-US',
        promptDelay: 5,
        preferences: '',
        sessionKey: null,
        scannedUrl: '', // New field to store scanned QR code URL
        sayVoice: null, // Voice for "say" prompts (things to repeat)
        doVoice: null   // Voice for "do" prompts (instructions)
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
    
    // Add voice selection UI
    addVoiceSelectionUI();
    
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
            document.getElementById('aiModel').value = configState.config.aiModel || '@cf/meta/llama-3.2-1b-instruct';
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
    
    // Save voice selections
    const sayVoiceSelect = document.getElementById('sayVoiceSelect');
    const doVoiceSelect = document.getElementById('doVoiceSelect');
    const voices = speechSynthesis.getVoices();
    
    // Update voice settings in config
    if (sayVoiceSelect.value) {
        const voiceIndex = parseInt(sayVoiceSelect.value);
        // We need to store the voice name and language since the actual SpeechSynthesisVoice object can't be serialized
        configState.config.sayVoiceName = voices[voiceIndex].name;
        configState.config.sayVoiceLang = voices[voiceIndex].lang;
    } else {
        configState.config.sayVoiceName = null;
        configState.config.sayVoiceLang = null;
    }
    
    if (doVoiceSelect.value) {
        const voiceIndex = parseInt(doVoiceSelect.value);
        configState.config.doVoiceName = voices[voiceIndex].name;
        configState.config.doVoiceLang = voices[voiceIndex].lang;
    } else {
        configState.config.doVoiceName = null;
        configState.config.doVoiceLang = null;
    }

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
 * Add voice selection UI elements
 */
function addVoiceSelectionUI() {
    // Create voice settings section
    const settingsSection = document.getElementById('configSection');
    const voiceSection = document.createElement('div');
    voiceSection.className = 'settings-group';
    voiceSection.innerHTML = `
        <h3>Voice Settings</h3>
        <p>Select different voices for different prompt types:</p>
        <div class="settings-row">
            <label for="sayVoiceSelect">Say Voice:</label>
            <div class="voice-control">
                <select id="sayVoiceSelect"></select>
                <button id="testSayVoice" class="action-button">Test</button>
            </div>
            <p class="help-text">"Say" voice is used for prompts that the broadcaster should repeat aloud.</p>
        </div>
        <div class="settings-row">
            <label for="doVoiceSelect">Do Voice:</label>
            <div class="voice-control">
                <select id="doVoiceSelect"></select>
                <button id="testDoVoice" class="action-button">Test</button>
            </div>
            <p class="help-text">"Do" voice is used for instructions and actions the broadcaster should perform.</p>
        </div>
        <div id="voiceLoadingStatus" style="margin-top: 10px;"></div>
    `;
    
    // Add the voice section to the settings section
    settingsSection.appendChild(voiceSection);
    
    // Initialize voice selects
    initVoiceSelects();
    
    // Add test button event listeners
    document.getElementById('testSayVoice').addEventListener('click', () => testVoice('say'));
    document.getElementById('testDoVoice').addEventListener('click', () => testVoice('do'));
}

// Initialize voice selection dropdowns
function initVoiceSelects() {
    const voiceLoadingStatus = document.getElementById('voiceLoadingStatus');
    voiceLoadingStatus.textContent = 'Loading available voices...';
    
    // Function to populate voice selects
    function populateVoiceSelects() {
        const voices = speechSynthesis.getVoices();
        const saySelect = document.getElementById('sayVoiceSelect');
        const doSelect = document.getElementById('doVoiceSelect');
        
        if (voices.length === 0) {
            voiceLoadingStatus.textContent = 'No voices available. Try reloading the page.';
            return;
        }
        
        voiceLoadingStatus.textContent = `${voices.length} voices available.`;
        
        // Clear and populate both selects
        [saySelect, doSelect].forEach(select => {
            // Save the current selected value if any
            const currentValue = select.value;
            
            // Clear options
            select.innerHTML = '';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Default Voice';
            select.appendChild(defaultOption);
            
            // Add voice options
            voices.forEach((voice, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${voice.name} (${voice.lang})`;
                select.appendChild(option);
            });
            
            // Restore the previous value if it exists
            if (currentValue) {
                select.value = currentValue;
            }
        });
        
        // Try to select saved voices by name and language
        if (configState.config.sayVoiceName) {
            const sayVoiceIndex = voices.findIndex(voice => 
                voice.name === configState.config.sayVoiceName && 
                voice.lang === configState.config.sayVoiceLang
            );
            
            if (sayVoiceIndex >= 0) {
                saySelect.value = sayVoiceIndex;
                // Also set the actual voice object for immediate use
                configState.config.sayVoice = voices[sayVoiceIndex];
            }
        }
        
        if (configState.config.doVoiceName) {
            const doVoiceIndex = voices.findIndex(voice => 
                voice.name === configState.config.doVoiceName && 
                voice.lang === configState.config.doVoiceLang
            );
            
            if (doVoiceIndex >= 0) {
                doSelect.value = doVoiceIndex;
                // Also set the actual voice object for immediate use
                configState.config.doVoice = voices[doVoiceIndex];
            }
        }
    }
    
    // Try to load voices
    populateVoiceSelects();
    
    // Set up the event to load voices when they change
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceSelects;
    }
    
    // Add change event listeners to save voice selections
    document.getElementById('sayVoiceSelect').addEventListener('change', (e) => {
        const voices = speechSynthesis.getVoices();
        const selectedIndex = e.target.value;
        configState.config.sayVoice = selectedIndex ? voices[selectedIndex] : null;
    });
    
    document.getElementById('doVoiceSelect').addEventListener('change', (e) => {
        const voices = speechSynthesis.getVoices();
        const selectedIndex = e.target.value;
        configState.config.doVoice = selectedIndex ? voices[selectedIndex] : null;
    });
}

// Test a selected voice
function testVoice(voiceType) {
    const selectId = voiceType === 'say' ? 'sayVoiceSelect' : 'doVoiceSelect';
    const select = document.getElementById(selectId);
    const selectedIndex = select.value;
    
    if (!selectedIndex) {
        // Using default voice
        const utterance = new SpeechSynthesisUtterance(
            voiceType === 'say' 
                ? 'This is the default "Say" voice test. Repeat this aloud.' 
                : 'This is the default "Do" voice test. This would be an instruction.'
        );
        utterance.lang = configState.config.promptLanguage;
        speechSynthesis.speak(utterance);
        return;
    }
    
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices[selectedIndex];
    
    if (selectedVoice) {
        const sampleText = voiceType === 'say' 
            ? 'This is the "Say" voice test. Repeat this aloud.' 
            : 'This is the "Do" voice test. This would be an instruction.';
        
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.voice = selectedVoice;
        speechSynthesis.speak(utterance);
    } else {
        alert('Please select a valid voice or try reloading the page.');
    }
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
