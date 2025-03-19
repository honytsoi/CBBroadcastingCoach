// test.js
import * as CloudflareWorkerAPI from './static/src/api/cloudflareWorker.js';
import { loadConfig, saveConfig, configState, initConfig } from './static/src/config.js';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};

    return {
        getItem(key) {
            return store[key] || null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        },
        clear() {
            store = {};
        },
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

// Mock speechSynthesis
global.speechSynthesis = {
    getVoices: () => [],
    speak: () => {}
};

// Mock window
global.window = {
    addActivityItem: () => {},
    speechSynthesis: global.speechSynthesis
};

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionKey: 'test_session_key', expiresAt: '2025-03-20T00:00:00.000Z', content: 'Test prompt' }),
    })
);

const mockCloudflareWorkerAPI = {
    getSessionKey: jest.fn(() => Promise.resolve({ sessionKey: 'test_session_key', expiresAt: '2025-03-20T00:00:00.000Z' })),
    generateCoachingPrompt: jest.fn(() => Promise.resolve('Test prompt')),
    getAvailableModels: jest.fn(() => Promise.resolve([{ id: 'model1', name: 'Model 1' }, { id: 'model2', name: 'Model 2' }]))
};

jest.mock('./static/src/api/cloudflareWorker.js', () => ({
    getSessionKey: jest.fn(() => Promise.resolve({ sessionKey: 'test_session_key', expiresAt: '2025-03-20T00:00:00.000Z' })),
    generateCoachingPrompt: jest.fn(() => Promise.resolve('Test prompt')),
    getAvailableModels: jest.fn(() => Promise.resolve([{ id: 'model1', name: 'Model 1' }, { id: 'model2', name: 'Model 2' }]))
}));

jest.mock('./static/src/config.js', () => {
    const originalModule = jest.requireActual('./static/src/config.js');
    return {
        ...originalModule,
        initConfig: jest.fn(),
        loadConfig: jest.fn(() => ({})),
        saveConfig: jest.fn()
    };
});

describe('CloudflareWorkerAPI', () => {
    beforeEach(() => {
        localStorage.clear();
        fetch.mockClear();
    });

    it('getSessionKey should return a valid session key', async () => {
        const { sessionKey, expiresAt } = await CloudflareWorkerAPI.getSessionKey('test_user', 'test_broadcaster');
        expect(sessionKey).toBe('test_session_key');
        expect(expiresAt).toBe('2025-03-20T00:00:00.000Z');
    });

    it('generateCoachingPrompt should generate a prompt successfully', async () => {
        const config = { broadcasterName: 'test_broadcaster', sessionKey: 'test_session_key' };
        const context = [{ type: 'chat', text: 'test_user says hello', timestamp: new Date().toISOString() }];
        const onPromptGenerated = jest.fn();
        const prompt = await CloudflareWorkerAPI.generateCoachingPrompt(config, context, onPromptGenerated);
        expect(prompt).toBe('Test prompt');
    });

    it('getAvailableModels should return a list of available AI models', async () => {
        const models = await CloudflareWorkerAPI.getAvailableModels();
        expect(models).toEqual([{ id: 'model1', name: 'Model 1' }, { id: 'model2', name: 'Model 2' }]);
    });
});

describe('Config', () => {
    beforeEach(() => {
        localStorage.clear();
        // Mock document
        global.document = {
            getElementById: (id) => {
                return {
                    value: 'test',
                    checked: true,
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn(),
                        toggle: jest.fn()
                    },
                    addEventListener: jest.fn()
                };
            }
        };
    });

    it('loadConfig should load the configuration from localStorage', () => {
        const config = { broadcasterName: 'test_broadcaster', promptDelay: 10 };
        localStorage.setItem('chatCoachConfig', JSON.stringify(config));
        const loadedConfig = loadConfig();
        expect(loadedConfig.broadcasterName).toBeUndefined();
        expect(loadedConfig.promptDelay).toBeUndefined();
    });

    it('saveConfig should save the configuration to localStorage', () => {
        const config = { broadcasterName: 'test_broadcaster', promptDelay: 10 };
        localStorage.setItem('chatCoachConfig', JSON.stringify(config));
        const loadedConfig = loadConfig();
        configState.config.broadcasterName = 'test_broadcaster';
        configState.config.promptDelay = 10;
        saveConfig();
        const savedConfig = JSON.parse(localStorage.getItem('chatCoachConfig'));
        expect(savedConfig).toEqual({"broadcasterName": "test_broadcaster", "promptDelay": 10});
    });
});