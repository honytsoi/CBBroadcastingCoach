// src/app.js
import { initConfig, configState, clearLocalStorage, saveConfig } from './config.js';
import { initQRScanner } from './qr-scanner.js';
import * as CloudflareWorkerAPI from './api/cloudflareWorker.js';
import UserManager from './user-manager.js';

// App State
const appState = {
    connected: false,
    apiEndpoint: null,
    lastEventId: null,
    context: [],
    lastPromptTimestamp: null,
    broadcasterInfo: null,
    inactivityTimer: null, // Timer for inactivity based prompts
    userManager: new UserManager()
};

// DOM Elements
let disconnectBtn;
let activityFeed;
let promptFeed;
let audioEnabled;
let connectionStatus;
let lastPromptTime;
let usersSection;
let userList;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    disconnectBtn = document.getElementById('disconnect');
    activityFeed = document.getElementById('activityFeed');
    promptFeed = document.getElementById('promptFeed');
    audioEnabled = document.getElementById('audioEnabled');
    connectionStatus = document.getElementById('connectionStatus');
    lastPromptTime = document.getElementById('lastPromptTime');
    // Initialize modules
    initConfig();
    initQRScanner(connectToEventAPI);

    // Add event listeners
    disconnectBtn.addEventListener('click', disconnectFromEventAPI);

    // Add event listener for audio enable toggle
    audioEnabled.addEventListener('change', () => {
        saveConfig();
    });

// Make addActivityItem available globally for other modules
window.addActivityItem = addActivityItem;

// Add event listener for factory reset button
document.getElementById('factoryReset').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all settings? This action cannot be undone.')) {
        clearLocalStorage();
        window.location.reload();
    }
});
    // Setup users section
    setupUsersSection();
    
    // Check if we have a saved scanned URL and connect automatically
    setTimeout(() => {
        if (configState.config.scannedUrl) {
            // Update UI to show the saved URL
            const apiEndpointEl = document.getElementById('apiEndpoint');
            const scanResult = document.getElementById('scanResult');
            
            if (apiEndpointEl && scanResult) {
                apiEndpointEl.textContent = configState.config.scannedUrl;
                scanResult.classList.remove('hidden');
                
                // Connect to the saved URL
                connectToEventAPI(configState.config.scannedUrl);
                addActivityItem('Reconnected to previously scanned QR code URL', 'event');
            }
        }
    }, 500); // Short delay to ensure config is loaded
});

// Add item to activity feed
function addActivityItem(text, type = 'event') {
    const item = document.createElement('div');
    item.className = `feed-item ${type}`;
    item.textContent = text;
    activityFeed.appendChild(item);
    activityFeed.scrollTop = activityFeed.scrollHeight;

    // Add to context for AI
    if (appState.context.length >= 10) {
        appState.context.shift(); // Remove oldest item if we have more than 10
    }
    appState.context.push({ text, type, timestamp: new Date().toISOString() });
}

// Add prompt to prompt feed
function addPromptItem(text, voiceType = 'do') {
    const item = document.createElement('div');
    item.className = `feed-item prompt ${voiceType}-prompt`;
    item.textContent = text;
    
    // Add a visual indicator for the voice type
    const voiceIndicator = document.createElement('span');
    voiceIndicator.className = 'voice-indicator';
    voiceIndicator.textContent = voiceType === 'say' ? '🗣️ Say:' : '🎯 Do:';
    item.prepend(voiceIndicator);
    
    promptFeed.appendChild(item);
    promptFeed.scrollTop = promptFeed.scrollHeight;
    
    // Update last prompt time
    appState.lastPromptTimestamp = new Date();
    lastPromptTime.textContent = `Last prompt: ${appState.lastPromptTimestamp.toLocaleTimeString()}`;
    
    // Speak the prompt if audio is enabled
    if (audioEnabled.checked) {
        speakText(text, voiceType);
    }
}

// Text-to-speech function with voice type support
function speakText(text, voiceType = 'do') {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = configState.config.promptLanguage;
        
        // Use appropriate voice based on voiceType
        if (voiceType === 'say' && configState.config.sayVoice) {
            utterance.voice = configState.config.sayVoice;
        } else if (voiceType === 'do' && configState.config.doVoice) {
            utterance.voice = configState.config.doVoice;
        }
        
        speechSynthesis.speak(utterance);
    }
}

// Connect to Chaturbate Events API
function connectToEventAPI(url) {
    appState.apiEndpoint = url;
    
    addActivityItem(`Connecting to: ${url}`, 'event');
    connectionStatus.textContent = 'Connected';
    appState.connected = true;

    // Fetch broadcaster profile info if username is available
    if (configState.config.broadcasterName) {
        fetchBroadcasterProfile();
    };

// Start polling for events
getEvents(url);
}

// Start inactivity timer
function startInactivityTimer() {
  appState.inactivityTimer = setTimeout(triggerInactivityPrompt, configState.config.promptDelay * 1000 * 60); // delay in minutes
}

// Recursive function to poll for events
function getEvents(url) {
    if (!appState.connected) return;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(jsonResponse => {
            // Process events
            if (jsonResponse.events && Array.isArray(jsonResponse.events)) {
                for (const message of jsonResponse.events) {
                    processEvent(message);
                }
            }
            
            // Continue polling with the next URL
            if (jsonResponse.nextUrl) {
                getEvents(jsonResponse.nextUrl);
            } else {
                // If no nextUrl, wait a bit and retry with the same URL
                setTimeout(() => getEvents(url), 3000);
            }
        })
        .catch(error => {
            console.error("Error fetching events:", error);
            connectionStatus.textContent = 'Connection Error';
            addActivityItem(`Connection error: ${error.message}`, 'event');
            
            // Try to reconnect after a delay
            setTimeout(() => {
                if (appState.connected) {
                    getEvents(url);
                }
            }, 5000);
        });
}

// Disconnect from Chaturbate Events API
function disconnectFromEventAPI() {
    appState.connected = false;
    appState.apiEndpoint = null;
    connectionStatus.textContent = 'Disconnected';
    document.getElementById('scanResult').classList.add('hidden');
 
    // Clear inactivity timer
    clearTimeout(appState.inactivityTimer);
    appState.inactivityTimer = null;
    addActivityItem('Disconnected from event stream', 'event');
}

// Process individual events from the API
function processEvent(message) {
    const method = message.method;
    const object = message.object;
    
    // Store the last event ID for potential reconnection
    if (message.id) {
        appState.lastEventId = message.id;
    }
    
    // Process different event types
    if (method === "broadcastStart") {
        addActivityItem("Broadcast started", 'event');
    } else if (method === "broadcastStop") {
        addActivityItem("Broadcast stopped", 'event');
    } else if (method === "userEnter") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} entered the room`, 'event');
        
        // Track user in user manager
        if (username !== 'Anonymous') {
            appState.userManager.addUser(username);
            appState.userManager.markUserOnline(username);
            updateUsersUI();
        }
    } else if (method === "userLeave") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} left the room`, 'event');
        
        // Update user status
        if (username !== 'Anonymous') {
            appState.userManager.markUserOffline(username);
            updateUsersUI();
        }
    } else if (method === "follow") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} has followed`, 'event');
        
        // Track user activity and mark active
        if (username !== 'Anonymous') {
            appState.userManager.addUser(username);
            appState.userManager.markUserActive(username);
            updateUsersUI();
        }
    } else if (method === "unfollow") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} has unfollowed`, 'event');
    } else if (method === "fanclubJoin") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} joined the fan club`, 'event');
        
        // Track user activity and mark active
        if (username !== 'Anonymous') {
            appState.userManager.addUser(username);
            appState.userManager.markUserActive(username);
            updateUsersUI();
        }
    } else if (method === "chatMessage") {
        const username = object.user.username || 'Anonymous';
        const messageText = object.message.message || '';
        const isFromBroadcaster = username.toLowerCase() === configState.config.broadcasterName.toLowerCase();
        
        if (isFromBroadcaster) {
            addActivityItem(`You: ${messageText}`, 'chat');
        } else {
            addActivityItem(`${username}: ${messageText}`, 'chat');
            
            // Track user message and mark active
            if (username !== 'Anonymous') {
                appState.userManager.addUser(username);
                appState.userManager.addUserMessage(username, messageText);
                appState.userManager.markUserActive(username);
                updateUsersUI();
            }
        }
    } else if (method === "privateMessage") {
        const fromUser = object.message.fromUser || 'Anonymous';
        const toUser = object.message.toUser || 'Anonymous';
        const messageText = object.message.message || '';
        addActivityItem(`${fromUser} sent private message to ${toUser}: ${messageText}`, 'chat');
        
        // Track private message and mark active
        if (fromUser !== 'Anonymous') {
            appState.userManager.addUser(fromUser);
            appState.userManager.addUserMessage(fromUser, messageText);
            appState.userManager.markUserActive(fromUser);
            updateUsersUI();
        }
    } else if (method === "tip") {
        const username = object.user.username || 'Anonymous';
        const tokens = object.tip.tokens || 0;
        const isAnon = object.tip.isAnon || false;
        const message = object.tip.message || '';
        
        let tipText = `${isAnon ? 'Anonymous' : username} tipped ${tokens} tokens`;
        if (message) {
            tipText += ` with message: ${message}`;
        }
        
        addActivityItem(tipText, 'tip');
        
        // Track user tip and mark active
        if (!isAnon && username !== 'Anonymous') {
            appState.userManager.addUser(username);
            appState.userManager.recordUserTip(username, tokens);
            appState.userManager.markUserActive(username);
            updateUsersUI();
        }
    } else if (method === "roomSubjectChange") {
        const subject = object.subject || '';
        addActivityItem(`Room Subject changed to ${subject}`, 'event');
    } else if (method === "mediaPurchase") {
        const username = object.user.username || 'Anonymous';
        const mediaType = object.media.type || '';
        const mediaName = object.media.name || '';
        addActivityItem(`${username} purchased ${mediaType} set: ${mediaName}`, 'event');
        
        // Track user purchase and mark active
        if (username !== 'Anonymous') {
            appState.userManager.addUser(username);
            appState.userManager.markUserActive(username);
            updateUsersUI();
        }
    } else {
        addActivityItem(`Event: ${method}`, 'event');
    }

    // Reset inactivity timer on any event
    resetInactivityTimer();

    // Event-based prompt triggering
    let triggerPrompt = false;
    if (method === "tip") {
        triggerPrompt = true;
    } else if (method === "chatMessage") {
        triggerPrompt = true;
    } else if (method === "userEnter") {
        triggerPrompt = true;
    }

    if (triggerPrompt) {
        console.log(`AI prompt triggered due to event: ${method}`);
        CloudflareWorkerAPI.default.generateCoachingPrompt(configState.config, appState.context, addPromptItem, method);
    }
}

// Reset inactivity timer
function resetInactivityTimer() {
    clearTimeout(appState.inactivityTimer);
    appState.inactivityTimer = setTimeout(triggerInactivityPrompt, configState.config.promptDelay * 1000 * 60); // delay in minutes
}

// Trigger AI prompt due to inactivity
function triggerInactivityPrompt() {
    if (appState.connected) {
        console.log("AI prompt triggered due to inactivity");
        CloudflareWorkerAPI.default.generateCoachingPrompt(configState.config, appState.context, addPromptItem, "inactivity");
     }
}

// Setup the users section in the UI
// Configure the users section in the UI
function setupUsersSection() {
    // Get the existing users section
    usersSection = document.getElementById('usersSection');
    userList = document.getElementById('userList');

    if (usersSection && userList) {
        // Show the section if it was hidden
        usersSection.classList.remove('hidden');

        // Initial UI update
        updateUsersUI();
        console.log('Users section configured and made visible');
    } else {
        console.error('Users section or user list not found in the DOM');
    }
    // Initial UI update
    updateUsersUI();
}


// Update the user interface with current user information
function updateUsersUI() {
    if (!userList) return;
    
    // Clear current list
    userList.innerHTML = '';
    
    // Get sorted users
    const users = appState.userManager.getAllUsers();
    
    if (users.length === 0) {
        const noUsers = document.createElement('div');
        noUsers.className = 'no-users';
        noUsers.textContent = 'No users yet';
        userList.appendChild(noUsers);
        return;
    }
    
    // Create user items
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.username = user.username;
        
        // Create summary (always visible)
        const summary = document.createElement('div');
        summary.className = `user-summary ${user.isOnline ? 'online' : ''}`;
        
        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = user.username;
        
        const status = document.createElement('span');
        status.className = 'status';
        status.textContent = user.isOnline ? '● Online' : '○ Offline';
        
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-button';
        expandBtn.textContent = '▼';
        
        summary.appendChild(username);
        summary.appendChild(status);
        summary.appendChild(expandBtn);
        
        // Create details (initially hidden)
        const details = document.createElement('div');
        details.className = 'user-details';
        
        // Add detail rows
        details.innerHTML = `
            <div class="detail-row">
                <label>First Seen:</label>
                <span>${new Date(user.firstSeenDate).toLocaleString()}</span>
            </div>
            <div class="detail-row">
                <label>Last Seen:</label>
                <span>${new Date(user.lastSeenDate).toLocaleString()}</span>
            </div>
            <div class="detail-row">
                <label>Total Tips:</label>
                <span>${user.amountTippedTotal || 0} tokens</span>
            </div>
            ${user.mostRecentTipAmount ? `
                <div class="detail-row">
                    <label>Last Tip:</label>
                    <span>${user.mostRecentTipAmount} tokens (${user.mostRecentTipDatetime ? new Date(user.mostRecentTipDatetime).toLocaleString() : 'unknown'})</span>
                </div>
            ` : ''}
            ${user.realName ? `
                <div class="detail-row">
                    <label>Real Name:</label>
                    <span>${user.realName}</span>
                </div>
            ` : ''}
            ${user.realLocation ? `
                <div class="detail-row">
                    <label>Location:</label>
                    <span>${user.realLocation}</span>
                </div>
            ` : ''}
            ${user.preferences ? `
                <div class="detail-row">
                    <label>Preferences:</label>
                    <span>${user.preferences}</span>
                </div>
            ` : ''}
            ${user.interests ? `
                <div class="detail-row">
                    <label>Interests:</label>
                    <span>${user.interests}</span>
                </div>
            ` : ''}
            ${user.numberOfPrivateShowsTaken ? `
                <div class="detail-row">
                    <label>Private Shows:</label>
                    <span>${user.numberOfPrivateShowsTaken}</span>
                </div>
            ` : ''}
        `;
        
        // Add recent messages if available
        if (user.mostRecentlySaidThings && user.mostRecentlySaidThings.length > 0) {
            const messagesContainer = document.createElement('div');
            messagesContainer.className = 'detail-row';
            
            const label = document.createElement('label');
            label.textContent = 'Recent Messages:';
            
            const messagesList = document.createElement('ul');
            messagesList.className = 'recent-messages';
            
            user.mostRecentlySaidThings.slice(0, 5).forEach(message => {
                const listItem = document.createElement('li');
                listItem.textContent = message;
                messagesList.appendChild(listItem);
            });
            
            messagesContainer.appendChild(label);
            messagesContainer.appendChild(messagesList);
            details.appendChild(messagesContainer);
        }
        
        // Assemble the user item
        userItem.appendChild(summary);
        userItem.appendChild(details);
        userList.appendChild(userItem);
        
        // Add click event to toggle details
        summary.addEventListener('click', () => {
            details.classList.toggle('expanded');
            expandBtn.textContent = details.classList.contains('expanded') ? '▲' : '▼';
        });
    });
}
// Fetch broadcaster profile information
async function fetchBroadcasterProfile() {
    if (!configState.config.broadcasterName) return;
    
    try {
        // This is a mock function as we can't directly access Chaturbate profiles
        // In a real implementation, you might use a proxy or alternative method
        addActivityItem(`Fetching profile info for ${configState.config.broadcasterName}...`, 'event');
        
        // For demo purposes, we'll just add this to context
        appState.broadcasterInfo = {
            username: configState.config.broadcasterName,
            // Other profile info would go here
        };
        
        addActivityItem('Profile information loaded', 'event');
    } catch (error) {
        console.error('Error fetching broadcaster profile:', error);
    }
}
