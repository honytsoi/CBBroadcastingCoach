// cloudflareWorker.js - Communicates with our custom Cloudflare Worker backend

const AI_API_ENDPOINT = 'https://apibackend.adult-webcam-faq.com/api/generate-prompt'; // Update this for production if necessary

let aiState = {
    isGeneratingPrompt: false,
};

async function generateCoachingPrompt(config, context, onPromptGenerated) {
    if (context.length === 0 || aiState.isGeneratingPrompt) return;

    aiState.isGeneratingPrompt = true;
    try {
        const recentEvents = context.map(item => {
            if (item.type === 'chat') {
                return `Chat: ${item.text}`;
            } else if (item.type === 'tip') {
                return `Tip: ${item.text}`;
            } else {
                return `Event: ${item.text}`;
            }
        }).join('\n');

        const response = await fetch(AI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: recentEvents,
                broadcaster: config.broadcasterName,
                preferences: config.preferences,
                sessionKey: config.sessionKey // Assuming you'll use session keys in the new backend
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const suggestion = data.content.trim();

        if (onPromptGenerated && typeof onPromptGenerated === 'function') {
            onPromptGenerated(suggestion);
        }

        return suggestion;
    } catch (error) {
        console.error('Error generating coaching prompt:', error);
        window.addActivityItem(`Error generating prompt: ${error.message}`, 'event');
        return null;
    } finally {
        aiState.isGeneratingPrompt = false;
    }
}

export default {
    generateCoachingPrompt
};