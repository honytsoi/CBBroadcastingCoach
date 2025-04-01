/* event-stream.js */
export class EventStream {
    constructor() {
        this.pollingInterval = null;
        this.url = '';
    }

    startListening(url, callbacks = {}) {
        this.url = url;
        const { onConnected, onEvent, onError } = callbacks;
        if (onConnected && typeof onConnected === 'function') {
            onConnected(url);
        }
        // Start polling every 5 seconds
        this.pollingInterval = setInterval(() => {
            try {
                const eventData = this.fetchEvent();
                if (onEvent && typeof onEvent === 'function') {
                    onEvent(eventData);
                }
            } catch (err) {
                if (onError && typeof onError === 'function') {
                    onError(err);
                }
            }
        }, 5000);
    }

    stopListening(callback) {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (callback && typeof callback === 'function') {
            callback();
        }
    }

    fetchEvent() {
        // Simulate fetching an event. Replace with real polling/fetch logic.
        return {
            type: "sampleEvent",
            timestamp: new Date().toISOString(),
            data: "Event data example"
        };
    }
}