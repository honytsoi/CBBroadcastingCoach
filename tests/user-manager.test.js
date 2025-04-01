// Convert to Jest syntax
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import assert from 'node:assert'; // Keep assert for specific checks if needed, or replace all

// --- Mock dependencies BEFORE importing UserManager ---
// jest is globally available in Jest environment, no need to import explicitly

// Mock modules directly with factory functions
jest.mock('../static/src/storage-manager.js', () => ({
    __esModule: true,
    saveUserData: jest.fn(() => {}),
    loadUserData: jest.fn(() => new Map()),
    handleQuotaError: jest.fn((map) => map),
}));

jest.mock('../static/src/displayError.js', () => ({
    __esModule: true,
    displayError: jest.fn(() => {}),
}));

// Import the mocked modules AFTER jest.mock calls
import { loadUserData, saveUserData, handleQuotaError } from '../static/src/storage-manager.js';
import { displayError } from '../static/src/displayError.js';

// --- Now import UserManager ---
import { UserManager } from '../static/src/user-manager.js';

// Mock localStorage if needed, as UserManager uses it
class MockLocalStorage {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return this.store[key] || null;
    }
    setItem(key, value) {
        this.store[key] = value.toString();
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}
global.localStorage = new MockLocalStorage();

// Mock PapaParse if it's expected globally but not available in Node test env
// If UserManager handles its absence gracefully, this might not be needed.
// global.Papa = { parse: (csv) => { /* basic mock parsing if needed */ return { data: [] }; } };

describe('UserManager - importTokenHistory', () => {
    let userManager;

    beforeEach(() => {
        localStorage.clear(); // Clear mock storage before each test
        // Use Jest's mockClear on the explicitly created mock functions
        // Use the imported mock functions directly
        loadUserData.mockClear();
        saveUserData.mockClear();
        handleQuotaError.mockClear();
        displayError.mockClear();

        // Mock loadUserData to return an empty map for the constructor call
        loadUserData.mockImplementation(() => new Map());

        // Instantiate UserManager - constructor will call loadUsers, which should now use the mocked dependencies
        userManager = new UserManager();

        // Ensure no users exist initially for clean tests
        // Check internal map directly as getAllUsers might have side effects or rely on loaded state
        expect(userManager.users.size).toBe(0);

        // Verify constructor called the mocked loadUserData
        expect(loadUserData).toHaveBeenCalledTimes(1);
        // Clear mocks AFTER constructor call verification
        loadUserData.mockClear();
        displayError.mockClear(); // Clear displayError mock too, in case constructor error path was hit
    });

    it('should import regular tips correctly', () => {
        const csvData = `User,Token change,Timestamp,Note
user1,10,2024-01-01T10:00:00Z,Tip 1
user2,20,2024-01-01T10:01:00Z,Tip 2
user1,5,2024-01-01T10:02:00Z,Tip 3`;

        const result = userManager.importTokenHistory(csvData);
        expect(result.success).toBe(true);
        expect(result.stats.users).toBe(2);
        expect(result.stats.tokens).toBe(35); // 10 + 20 + 5

        const user1 = userManager.getUser('user1');
        const user2 = userManager.getUser('user2');

        expect(user1).toBeDefined();
        expect(user2).toBeDefined();
        expect(user1.eventHistory).toHaveLength(2);
        expect(user2.eventHistory).toHaveLength(1);
        expect(user1.eventHistory[0].type).toBe('tip');
        expect(user1.eventHistory[0].data.amount).toBe(5);
        expect(user1.eventHistory[1].data.amount).toBe(10);
        expect(user2.eventHistory[0].data.amount).toBe(20);
        expect(user1.tokenStats.totalSpent).toBe(15);
        expect(user2.tokenStats.totalSpent).toBe(20);
    });

    it('should skip duplicate entries', () => {
        // Add an initial event using the same timestamp format as the import process
        const initialTimestamp = new Date('2024-01-01T10:00:00Z').toISOString();
        userManager.addEvent('user1', 'tip', { amount: 10, timestamp: initialTimestamp });
        
        const csvData = `User,Token change,Timestamp,Note
user1,10,2024-01-01T10:00:00Z,Duplicate Tip 1 // Exact duplicate
user1,20,2024-01-01T10:01:00Z,New Tip 2`;

        const result = userManager.importTokenHistory(csvData);
        expect(result.success).toBe(true);
        expect(result.stats.tokens).toBe(20); // Only New Tip 2

        const user1 = userManager.getUser('user1');
        expect(user1).toBeDefined();
        // Should have the initial event + the new one (2 total)
        expect(user1.eventHistory).toHaveLength(2);
        expect(user1.eventHistory[0].data.amount).toBe(20);
        expect(user1.eventHistory[1].data.amount).toBe(10);
        expect(user1.tokenStats.totalSpent).toBe(30);
    });

    it('should generate privateShow meta events correctly', () => {
        const csvData = `User,Token change,Timestamp,Note
user3,10,2024-01-01T11:00:00Z,Private Show Started
user3,10,2024-01-01T11:00:10Z,Private Show
user3,10,2024-01-01T11:00:20Z,Private Show Ended // 20s duration
user3,5,2024-01-01T11:01:00Z,Regular Tip`; // Separate tip after show

        const result = userManager.importTokenHistory(csvData);
        expect(result.success).toBe(true);
        // Tokens = 30 from show + 5 from tip
        expect(result.stats.tokens).toBe(35);

        const user3 = userManager.getUser('user3');
        expect(user3).toBeDefined();
        // Should have 1 meta event + 1 tip event = 2 events
        expect(user3.eventHistory).toHaveLength(2);
        
        const metaEvent = user3.eventHistory.find(e => e.type === 'privateShow');
        const tipEvent = user3.eventHistory.find(e => e.type === 'tip');

        expect(metaEvent).toBeDefined();
        expect(tipEvent).toBeDefined();

        expect(metaEvent.data.tokens).toBe(30);
        expect(metaEvent.data.amount).toBe(30);
        expect(metaEvent.data.duration).toBe(20);
        expect(metaEvent.data.startTime).toBe('2024-01-01T11:00:00.000Z');
        expect(metaEvent.data.endTime).toBe('2024-01-01T11:00:20.000Z');

        expect(tipEvent.data.amount).toBe(5);
        expect(user3.tokenStats.totalSpent).toBe(35);
    });
    
    it('should generate privateShowSpy meta events correctly', () => {
        const csvData = `User,Token change,Timestamp,Note
user4,5,2024-01-01T12:00:00Z,Spy Show Started
user4,5,2024-01-01T12:00:10Z,Spy Show Ended`; // 10s duration

        const result = userManager.importTokenHistory(csvData);
        expect(result.success).toBe(true);
        expect(result.stats.tokens).toBe(10);

        const user4 = userManager.getUser('user4');
        expect(user4).toBeDefined();
        expect(user4.eventHistory).toHaveLength(1);

        const metaEvent = user4.eventHistory[0];
        expect(metaEvent.type).toBe('privateShowSpy');
        expect(metaEvent.data.tokens).toBe(10);
        expect(metaEvent.data.duration).toBe(10);
    });

    it('should handle multiple private shows for the same user', () => {
        const csvData = `User,Token change,Timestamp,Note
user5,10,2024-01-01T13:00:00Z,Private Show
user5,10,2024-01-01T13:00:10Z,Private Show // Show 1 ends
user5,20,2024-01-01T13:01:00Z,Private Show // Show 2 starts (gap > 30s)
user5,20,2024-01-01T13:01:10Z,Private Show`; // Show 2 ends

        const result = userManager.importTokenHistory(csvData);
        expect(result.success).toBe(true);
        expect(result.stats.tokens).toBe(60); // 20 + 40

        const user5 = userManager.getUser('user5');
        expect(user5).toBeDefined();
        expect(user5.eventHistory).toHaveLength(2);

        const show1 = user5.eventHistory.find(e => e.data.startTime === '2024-01-01T13:00:00.000Z');
        const show2 = user5.eventHistory.find(e => e.data.startTime === '2024-01-01T13:01:00.000Z');

        expect(show1).toBeDefined();
        expect(show2).toBeDefined();
        expect(show1.data.tokens).toBe(20);
        expect(show1.data.duration).toBe(10);
        expect(show2.data.tokens).toBe(40);
        expect(show2.data.duration).toBe(10);
        expect(user5.tokenStats.totalSpent).toBe(60);
    });

    it('should handle mixed tips and private shows', () => {
        const csvData = `User,Token change,Timestamp,Note
user6,5,2024-01-01T14:00:00Z,Tip 1
user6,10,2024-01-01T14:00:30Z,Private Show
user6,10,2024-01-01T14:00:40Z,Private Show
user6,7,2024-01-01T14:01:00Z,Tip 2`;

        const result = userManager.importTokenHistory(csvData);
        expect(result.success).toBe(true);
        expect(result.stats.tokens).toBe(32); // 5 + 20 + 7

        const user6 = userManager.getUser('user6');
        expect(user6).toBeDefined();
        // 1 tip, 1 meta, 1 tip = 3 events
        expect(user6.eventHistory).toHaveLength(3);

        const metaEvent = user6.eventHistory.find(e => e.type === 'privateShow');
        expect(metaEvent).toBeDefined();
        expect(metaEvent.data.tokens).toBe(20);
        expect(metaEvent.data.duration).toBe(10);

        const tips = user6.eventHistory.filter(e => e.type === 'tip');
        expect(tips).toHaveLength(2);
        expect(user6.tokenStats.totalSpent).toBe(32);
    });

});


// --- New Test Suite for Storage Interaction ---
describe('UserManager - Storage Interaction', () => {
    let userManager;

    beforeEach(() => {
        // Reset mocks before each test
        // Clear the imported mock functions directly
        loadUserData.mockClear();
        saveUserData.mockClear();
        handleQuotaError.mockClear();
        displayError.mockClear();

        // Mock loadUserData for constructor
        // Mock loadUserData for constructor call within this specific beforeEach
        loadUserData.mockImplementation(() => new Map());
        userManager = new UserManager();
        // Clear mocks AFTER constructor call
        loadUserData.mockClear();
        displayError.mockClear();
    });

    // --- loadUsers Tests ---
    it('loadUsers should call loadUserData and process the result', () => {
        const loadedData = new Map([
            ['user1', { username: 'user1', data: 'value1', isOnline: true }], // isOnline should be reset
            ['user2', { username: 'user2', data: 'value2' }],
        ]);
        loadUserData.mockImplementationOnce(() => loadedData);

        // Manually call the actual loadUsers method for testing its logic
        userManager.loadUsers();

        expect(loadUserData).toHaveBeenCalledTimes(1);
        expect(userManager.users.size).toBe(2);

        const user1 = userManager.getUser('user1');
        expect(user1).toBeDefined();
        expect(user1.data).toBe('value1');
        expect(user1.isOnline).toBe(false); // Important check

        const user2 = userManager.getUser('user2');
        expect(user2).toBeDefined();
        expect(user2.data).toBe('value2');
        expect(user2.isOnline).toBe(false);
        // Check if default fields are merged (example: eventHistory)
        expect(Array.isArray(user1.eventHistory)).toBe(true);
    });

    it('loadUsers should handle empty map from loadUserData', () => {
        loadUserData.mockImplementationOnce(() => new Map());
        // Manually call the actual loadUsers method
        userManager.loadUsers();
        expect(loadUserData).toHaveBeenCalledTimes(1);
        expect(userManager.users.size).toBe(0);
    });

     it('loadUsers should handle errors during processing and call displayError', () => {
        const loadedData = new Map([['user1', { username: 'user1' }]]);
        loadUserData.mockImplementationOnce(() => loadedData);

        // Force an error during processing by mocking getDefaultUser temporarily
        const originalGetDefault = userManager.getDefaultUser;
        userManager.getDefaultUser = () => { throw new Error("Processing error"); };

        // Manually call the actual loadUsers method
        userManager.loadUsers();

        userManager.getDefaultUser = originalGetDefault; // Restore original method

        expect(loadUserData).toHaveBeenCalledTimes(1);
        expect(userManager.users.size).toBe(0);
        expect(displayError).toHaveBeenCalledTimes(1);
    });


    // --- saveUsers Tests ---
    it('saveUsers should call saveUserData with the current users map', () => {
        userManager.addUser('user1');
        userManager.addUser('user2');
        const currentUsersMap = userManager.users;

        userManager.saveUsers();

        expect(saveUserData).toHaveBeenCalledTimes(1);
        // Check that the argument passed was the userManager's internal map
        expect(saveUserData).toHaveBeenCalledWith(currentUsersMap);
    });

    it('saveUsers should handle QuotaExceededError, call handleQuotaError, and retry save', () => {
        userManager.addUser('user1');
        userManager.addUser('user2'); // Map has 2 users
        const originalMap = userManager.users;
        const reducedMap = new Map([['user2', originalMap.get('user2')]]); // Simulate removing user1

        // Mock saveUserData to throw QuotaExceededError on first call
        const quotaError = new Error('Quota exceeded');
        quotaError.name = 'QuotaExceededError';
        saveUserData.mockImplementationOnce(() => { throw quotaError; });

        // Mock handleQuotaError to return the reduced map
        handleQuotaError.mockImplementationOnce(() => reducedMap);

        // Mock saveUserData to succeed on the second call (retry)
        saveUserData.mockImplementationOnce(() => {});

        userManager.saveUsers();

        // Verify calls
        expect(saveUserData).toHaveBeenCalledTimes(2);
        expect(handleQuotaError).toHaveBeenCalledTimes(1);
        expect(handleQuotaError).toHaveBeenCalledWith(originalMap);

        // Verify internal state updated and retry save called with reduced map
        expect(userManager.users).toBe(reducedMap);
        expect(saveUserData).toHaveBeenNthCalledWith(2, reducedMap);
        expect(displayError).not.toHaveBeenCalled();
    });

    it('saveUsers should handle non-quota error and call displayError', () => {
        userManager.addUser('user1');
        const genericError = new Error('Generic save error');
        saveUserData.mockImplementationOnce(() => { throw genericError; });

        userManager.saveUsers();

        expect(saveUserData).toHaveBeenCalledTimes(1);
        expect(handleQuotaError).not.toHaveBeenCalled();
        expect(displayError).toHaveBeenCalledTimes(1);
    });

     it('saveUsers should handle error during retry save after quota handling and call displayError', () => {
        userManager.addUser('user1');
        userManager.addUser('user2');
        const originalMap = userManager.users;
        const reducedMap = new Map([['user2', originalMap.get('user2')]]);

        // Mock saveUserData to throw QuotaExceededError on first call
        const quotaError = new Error('Quota exceeded');
        quotaError.name = 'QuotaExceededError';
        saveUserData.mockImplementationOnce(() => { throw quotaError; });

        // Mock handleQuotaError
        handleQuotaError.mockImplementationOnce(() => reducedMap);

        // Mock saveUserData to throw error on the second call (retry)
        const retryError = new Error('Retry save failed');
        saveUserData.mockImplementationOnce(() => { throw retryError; });

        userManager.saveUsers();

        // Verify calls
        expect(saveUserData).toHaveBeenCalledTimes(2);
        expect(handleQuotaError).toHaveBeenCalledTimes(1);
        expect(displayError).toHaveBeenCalledTimes(1);
        expect(displayError).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Failed to save user data due to storage limits')
        }));
    });

});
