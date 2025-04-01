/* ui-manager.js */
export class UIManager {
    constructor() {
        // Cache relevant DOM elements
        this.connectionStatus = document.getElementById("connectionStatus");
        this.activityFeed = document.getElementById("activityFeed");
        this.promptContainer = document.getElementById("promptContainer");
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Example: disconnect button
        const disconnectBtn = document.getElementById("disconnectBtn");
        if (disconnectBtn) {
            disconnectBtn.addEventListener("click", () => {
                console.log("Disconnect button clicked.");
            });
        }
        // Additional UI event listeners can be added here.
    }

    showConnected(url) {
        if (this.connectionStatus) {
            this.connectionStatus.textContent = `Connected to ${url}`;
        }
    }

    showDisconnected() {
        if (this.connectionStatus) {
            this.connectionStatus.textContent = "Disconnected";
        }
    }

    addActivity(text, type) {
        if (this.activityFeed) {
            const li = document.createElement("li");
            li.textContent = `[${type}] ${text}`;
            this.activityFeed.appendChild(li);
        }
    }

    addPrompt(text, voiceType) {
        if (this.promptContainer) {
            const li = document.createElement("li");
            li.textContent = `[${voiceType}] ${text}`;
            this.promptContainer.appendChild(li);
        }
    }

    showImportResult(message, type) {
        console.log(`Import Result: ${message} | Type: ${type}`);
    }
}