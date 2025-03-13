// src/app.js
import { initConfig, configState } from './config.js';
import { initQRScanner } from './qr-scanner.js';
import * as CloudflareWorkerAPI from './api/cloudflareWorker.js';

// App State
const appState = {
    connected: false,
    apiEndpoint: null,
    lastEventId: null,
    context: [],
    lastPromptTimestamp: null,
    broadcasterInfo: null
};

// DOM Elements
let disconnectBtn;
let activityFeed;
let promptFeed;
let audioEnabled;
let connectionStatus;
let lastPromptTime;

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
    
    // Make addActivityItem available globally for other modules
    window.addActivityItem = addActivityItem;
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
function addPromptItem(text) {
    const item = document.createElement('div');
    item.className = 'feed-item prompt';
    item.textContent = text;
    promptFeed.appendChild(item);
    promptFeed.scrollTop = promptFeed.scrollHeight;
    
    // Update last prompt time
    appState.lastPromptTimestamp = new Date();
    lastPromptTime.textContent = `Last prompt: ${appState.lastPromptTimestamp.toLocaleTimeString()}`;
    
    // Speak the prompt if audio is enabled
    if (audioEnabled.checked) {
        speakText(text);
    }
}

// Text-to-speech function
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = configState.config.promptLanguage;
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
    }

    // Start polling for events
    getEvents(url);
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
    } else if (method === "userLeave") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} left the room`, 'event');
    } else if (method === "follow") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} has followed`, 'event');
    } else if (method === "unfollow") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} has unfollowed`, 'event');
    } else if (method === "fanclubJoin") {
        const username = object.user.username || 'Anonymous';
        addActivityItem(`${username} joined the fan club`, 'event');
    } else if (method === "chatMessage") {
        const username = object.user.username || 'Anonymous';
        const messageText = object.message.message || '';
        const isFromBroadcaster = username.toLowerCase() === configState.config.broadcasterName.toLowerCase();
        
        if (isFromBroadcaster) {
            addActivityItem(`You: ${messageText}`, 'chat');
        } else {
            addActivityItem(`${username}: ${messageText}`, 'chat');
        }
    } else if (method === "privateMessage") {
        const fromUser = object.message.fromUser || 'Anonymous';
        const toUser = object.message.toUser || 'Anonymous';
        const messageText = object.message.message || '';
        addActivityItem(`${fromUser} sent private message to ${toUser}: ${messageText}`, 'chat');
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
    } else if (method === "roomSubjectChange") {
        const subject = object.subject || '';
        addActivityItem(`Room Subject changed to ${subject}`, 'event');
    } else if (method === "mediaPurchase") {
        const username = object.user.username || 'Anonymous';
        const mediaType = object.media.type || '';
        const mediaName = object.media.name || '';
        addActivityItem(`${username} purchased ${mediaType} set: ${mediaName}`, 'event');
    } else {
        addActivityItem(`Event: ${method}`, 'event');
    }
    
    // Generate AI coaching prompt if enough time has passed
    const now = new Date();
    const timeSinceLastPrompt = appState.lastPromptTimestamp 
        ? (now - appState.lastPromptTimestamp) / 1000 
        : configState.config.promptDelay + 1;
            
    if (timeSinceLastPrompt > configState.config.promptDelay) {
        // Changed reference to CloudflareWorkerAPI.generateCoachingPrompt
        CloudflareWorkerAPI.default.generateCoachingPrompt(configState.config, appState.context, addPromptItem);
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