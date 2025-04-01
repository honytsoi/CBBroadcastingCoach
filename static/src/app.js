/* app.js */
import { UIManager } from './ui-manager.js';
import { EventStream } from './event-stream.js';
import { EventProcessor } from './event-processor.js';
import { PromptTrigger } from './prompt-trigger.js';
import { Speech } from './speech.js';

document.addEventListener("DOMContentLoaded", () => {
    // Initialize UI Manager
    const uiManager = new UIManager();

    // Define configuration state (modify as needed)
    const configState = {
        apiEndpoint: "https://api.example.com/events"
    };

    // Initialize Prompt Trigger with dependencies
    const promptTrigger = new PromptTrigger({ uiManager, configState });

    // Initialize Event Stream
    const eventStream = new EventStream();

    // Initialize Event Processor with necessary dependencies.
    const eventProcessor = new EventProcessor({
        uiManager,
        promptTrigger,
        userManager: {
            updateUserData: (data) => {
                uiManager.addActivity("User data updated.", "info");
                console.log("User data:", data);
            }
        }
    });

    // Initialize Speech for text-to-speech functionality
    const speech = new Speech();

    // Start prompt trigger (inactivity monitoring)
    promptTrigger.start();

    // Connect to the event stream with callbacks
    eventStream.startListening(configState.apiEndpoint, {
        onConnected: (url) => {
            uiManager.showConnected(url);
            uiManager.addActivity("Connected to event stream.", "system");
        },
        onEvent: (event) => {
            eventProcessor.process(event);
        },
        onError: (err) => {
            uiManager.addActivity(`Stream error: ${err}`, "error");
        }
    });

    // Attach event listener for disconnect button
    const disconnectBtn = document.getElementById("disconnectBtn");
    if (disconnectBtn) {
        disconnectBtn.addEventListener("click", () => {
            eventStream.stopListening(() => {
                uiManager.showDisconnected();
                uiManager.addActivity("Disconnected from event stream.", "system");
            });
        });
    }
});
