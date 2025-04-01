// Centralized AI model configuration
// This is the single source of truth for AI models in the application

const AI_MODELS = [
    {
        id: '@hf/mistral/mistral-7b-instruct-v0.2',
        provider: 'Cloudflare-Worker-AI',
        name: 'Mistral 7B Instruct v0.2',
        description: 'Fast, adult-friendly'
    },
    {
        id: '@cf/meta/llama-3.2-1b-instruct',
        provider: 'Cloudflare-Worker-AI',
        name: 'Llama 3.2 1B',
        description: 'Basic fast'
    },
    {
        id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        provider: 'Cloudflare-Worker-AI',
        name: 'Llama 3.3 70B FP8 Fast',
        description: 'Fast but better for complex prompts'
    },

    // Commented out models for future use
    // {
    //   id: 'meta-llama/llama-3.2-3b-instruct:free',
    //   provider: 'OpenRouter.AI',
    //   name: 'Llama 3.2 3B Instruct',
    //   description: 'Fast free model with basic capabilities'
    // },
    // {
    //   id: 'google/gemini-2.0-flash-lite-001',
    //   provider: 'OpenRouter.AI',
    //   name: 'Gemini 2.0 Flash Lite',
    //   description: 'Fast and affordable option'
    // },
    // {
    //   id: 'mistralai/mistral-small-24b-instruct-2501',
    //   provider: 'OpenRouter.AI',
    //   name: 'Mistral Small',
    //   description: 'Adult-friendly model with good performance'
    // },
    // {
    //   id: 'anthropic/claude-3.7-sonnet',
    //   provider: 'OpenRouter.AI',
    //   name: 'Claude 3.7 Sonnet',
    //   description: 'Smart but expensive premium option'
    // }
];

// Export the default model (first in the list)
const DEFAULT_MODEL = AI_MODELS[0].id;

// Export the list of approved model IDs for validation
const APPROVED_MODELS = AI_MODELS.map(model => model.id);

// Export all configurations
export const models = {
    AI_MODELS,
    DEFAULT_MODEL,
    APPROVED_MODELS
};
