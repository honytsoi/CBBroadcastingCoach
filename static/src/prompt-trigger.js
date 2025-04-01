/* prompt-trigger.js */
export class PromptTrigger {
    constructor({ uiManager, configState }) {
        this.uiManager = uiManager;
        this.configState = configState;
        this.inactivityTimer = null;
    }

    start() {
        this.resetActivityTimer();
    }

    stop() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }

    resetActivityTimer() {
        this.stop();
        // Restart inactivity timer (e.g., set for 30 seconds)
        this.inactivityTimer = setTimeout(() => {
            this.triggerInactivityPrompt();
        }, 30000);
    }

    notifyEvent(eventType) {
        // Reset inactivity timer whenever an event is received
        this.resetActivityTimer();
        // Example: trigger an immediate prompt for a special event type
        if (eventType === "specialEvent") {
            this.triggerPrompt(`Special event triggered: ${eventType}`, "default");
        }
    }

    triggerPrompt(promptText, voiceType) {
        if (this.uiManager) {
            this.uiManager.addPrompt(promptText, voiceType);
        }
        // In production, integrate Cloudflare Worker API call here.
    }

    triggerInactivityPrompt() {
        this.triggerPrompt("No activity detected. Are you still there?", "reminder");
    }
}