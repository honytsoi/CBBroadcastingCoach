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
let importTokenHistoryBtn;
let dataManagementResult;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    disconnectBtn = document.getElementById('disconnect');
    activityFeed = document.getElementById('activityFeed');
    promptFeed = document.getElementById('promptFeed');
    audioEnabled = document.getElementById('audioEnabled');
    connectionStatus = document.getElementById('connectionStatus');
    lastPromptTime = document.getElementById('lastPromptTime');
    importTokenHistoryBtn = document.getElementById('importTokenHistory');
    dataManagementResult = document.getElementById('dataManagementResult');

    // Initialize modules
    initConfig();
    initQRScanner(connectToEventAPI);

    // Add event listeners
    disconnectBtn.addEventListener('click', disconnectFromEventAPI);
    importTokenHistoryBtn.addEventListener('click', handleImportTokenHistory);

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


/**
 * Format event timestamp.
 * If event occurred today, returns time; otherwise returns date and time.
 */
function formatEventTimestamp(isoTimestampString) {
    const eventDate = new Date(isoTimestampString);
    const now = new Date();
    if (eventDate.toDateString() === now.toDateString()) {
        return eventDate.toLocaleTimeString();
    } else {
        const year = eventDate.getFullYear();
        const month = String(eventDate.getMonth() + 1).padStart(2, '0');
        const day = String(eventDate.getDate()).padStart(2, '0');
        const hours = String(eventDate.getHours()).padStart(2, '0');
        const minutes = String(eventDate.getMinutes()).padStart(2, '0');
        const seconds = String(eventDate.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}

const INITIAL_EVENTS_TO_SHOW = 5;
const EVENTS_PER_LOAD = 20;

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
            <div class="detail-row">
                <label>Token Stats:</label>
                <div class="token-stats">
                    <span>Total: ${user.tokenStats.totalSpent || 0}</span>
                    <span>7d: ${user.tokenStats.timePeriods.day7.tips || 0}</span>
                    <span>30d: ${user.tokenStats.timePeriods.day30.tips || 0}</span>
                </div>
            </div>
        `;
        
        // Add event timeline if available
        if (user.eventHistory && user.eventHistory.length > 0) {
            const timelineContainer = document.createElement('div');
            timelineContainer.className = 'detail-row';
            
            const label = document.createElement('label');
            label.textContent = 'Recent Activity:';
            
            const timeline = document.createElement('div');
            timeline.className = 'event-timeline';
            
            // Paginate events: show initial batch and add "Load More" button if needed
            const initialRendered = renderEventBatch(user, timeline, 0, INITIAL_EVENTS_TO_SHOW);
            timeline.dataset.shownEvents = initialRendered;
            addLoadMoreButtonIfNeeded(user, timeline);
            
            timelineContainer.appendChild(label);
            timelineContainer.appendChild(timeline);
            details.appendChild(timelineContainer);
        } else {
             // If no history, show a message
            const noHistory = document.createElement('div');
            noHistory.className = 'detail-row no-history';
            noHistory.textContent = 'No event history recorded yet.';
            details.appendChild(noHistory);
        }
        
        // Add recent messages if available (legacy) - Keep for now, might remove later
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

function createEventElement(event) {
    const eventItem = document.createElement('div');
    if (event.type) {
        switch (event.type) {
            case 'tip':
                eventItem.textContent = (event.data && event.data.note) ?
                    `Tip: ${event.data.amount} tokens - ${event.data.note}` :
                    `Tip: ${event.data.amount} tokens`;
                break;
            case 'chatMessage':
                eventItem.textContent = `Said: ${event.data.content}`;
                break;
            case 'privateMessage':
                eventItem.textContent = `Private: ${event.data.content}`;
                break;
            case 'privateShow':
                eventItem.textContent = `Private Show (${event.data.duration}s, ${event.data.tokens} tokens)`;
                break;
            case 'privateShowSpy':
                eventItem.textContent = `Spy Show (${event.data.duration}s, ${event.data.tokens} tokens)`;
                break;
            case 'mediaPurchase':
                eventItem.textContent = `Media Purchase: ${event.data.item} (${event.data.amount} tokens)`;
                break;
            default:
                eventItem.textContent = `${event.type}`;
        }
    } else {
        eventItem.textContent = "Event";
    }
    return eventItem;
}

function renderEventBatch(user, timelineElement, startIndex, count) {
    const events = user.eventHistory.slice(startIndex, startIndex + count);
    events.forEach(event => {
        const eventItem = createEventElement(event);
        timelineElement.appendChild(eventItem);
    });
    return events.length;
}

function addLoadMoreButtonIfNeeded(user, timelineElement) {
    const shownCount = parseInt(timelineElement.dataset.shownEvents || '0', 10);
    const totalCount = user.eventHistory.length;
    if (shownCount < totalCount) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = `Load More (${totalCount - shownCount} remaining)`;
        loadMoreBtn.className = 'load-more-events';
        loadMoreBtn.addEventListener('click', () => {
            const currentShown = parseInt(timelineElement.dataset.shownEvents || '0', 10);
            const renderedCount = renderEventBatch(user, timelineElement, currentShown, EVENTS_PER_LOAD);
            timelineElement.dataset.shownEvents = currentShown + renderedCount;
            loadMoreBtn.remove();
            addLoadMoreButtonIfNeeded(user, timelineElement);
        });
        timelineElement.appendChild(loadMoreBtn);
    }
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

// Handle Token History CSV Import
function handleImportTokenHistory() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv'; // Accept only CSV files

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return; // No file selected
        }

        if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
            displayImportResult('Error: Please select a valid CSV file.', false);
            return;
        }

        // Display processing message
        displayImportResult('Processing CSV file...', 'info'); // Use 'info' class or similar for neutral message

        const reader = new FileReader();

        reader.onload = (e) => {
            const csvData = e.target.result;
            try {
                // Check if PapaParse is loaded
                if (typeof Papa === 'undefined') {
                    console.warn('PapaParse library not found. Using simple CSV parser (may be less reliable).');
                    // The userManager method already includes a fallback, so we can proceed.
                }
                // Call the import method within a try-catch for unexpected errors
                let result;
                try {
                    result = appState.userManager.importTokenHistory(csvData);
                } catch (importError) {
                    console.error('Unexpected error during token history import:', importError);
                    displayImportResult(`Unexpected error during import: ${importError.message}`, 'error');
                    return; // Stop further processing
                }

                // Display the result message from the import method
                displayImportResult(result.message, result.success ? 'success' : 'error');
                
                if (result.success) {
                    updateUsersUI(); // Refresh user list after successful import
                }
                
            } catch (error) { // Catch errors from PapaParse or initial processing
                console.error('Error processing token history CSV:', error);
                displayImportResult(`Error processing file: ${error.message}`, 'error');
            }
        };

        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            displayImportResult('Error reading the selected file.', false);
        };

        reader.readAsText(file); // Read the file as text
    });

    fileInput.click(); // Trigger the file selection dialog
}

// Helper function to display import/export results
function displayImportResult(message, type = 'info') { // type can be 'success', 'error', 'info'
    if (!dataManagementResult) return;
    dataManagementResult.textContent = message;
    dataManagementResult.className = `result-box ${type}`; // Use type for class
    // Keep the message visible for a while, unless it's just 'info'
    if (type !== 'info') {
        setTimeout(() => {
            dataManagementResult.classList.add('hidden');
        }, 10000); // Hide after 10 seconds for success/error
    } else {
        // Info messages don't auto-hide, they get replaced by success/error
        dataManagementResult.classList.remove('hidden');
    } 
}
