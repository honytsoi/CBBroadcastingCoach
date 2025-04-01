/* event-processor.js */
export class EventProcessor {
    constructor({ uiManager, promptTrigger, userManager }) {
        this.uiManager = uiManager;
        this.promptTrigger = promptTrigger;
        this.userManager = userManager;
    }

    process(event) {
        // Log the event in the UI
        if (this.uiManager) {
            this.uiManager.addActivity(`Received event: ${event.type}`, "event");
        }
        // Update user data if applicable
        if (this.userManager && typeof this.userManager.updateUserData === 'function') {
            this.userManager.updateUserData(event.data);
        }
        // Notify prompt trigger about the event
        if (this.promptTrigger) {
            this.promptTrigger.notifyEvent(event.type);
        }
    }
}