// Convert to Jest syntax
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { saveUserData, loadUserData, handleQuotaError } from '../static/src/storage-manager.js';

// --- Mock localStorage ---
class MockLocalStorage {
    constructor() {
        this.store = {};
        this.quotaExceeded = false; // Flag to simulate quota errors
    }
    getItem(key) {
        return this.store[key] || null;
    }
    setItem(key, value) {
        if (this.quotaExceeded) {
            const error = new Error('Mock QuotaExceededError');
            error.name = 'QuotaExceededError';
            throw error;
        }
        // Basic size check approximation for quota simulation (very rough)
        if (JSON.stringify(this.store).length + value.length > 5000) { // Arbitrary limit for testing
             this.quotaExceeded = true; // Set flag for next attempt if needed
             const error = new Error('Mock QuotaExceededError: Storage limit reached');
             error.name = 'QuotaExceededError';
             throw error;
        }
        this.store[key] = value.toString();
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
        this.quotaExceeded = false;
    }
    // Helper to simulate quota being exceeded on next setItem call
    simulateQuotaExceeded() {
        this.quotaExceeded = true;
    }
    // Helper to reset quota simulation
    resetQuotaSimulation() {
        this.quotaExceeded = false;
    }
}
// Assign mock to globalThis for Jest environment
globalThis.localStorage = new MockLocalStorage();
const STORAGE_KEY = 'broadcastCoachUsers'; // As defined in storage-manager

// --- Test Suite ---
describe('StorageManager Tests', () => {

    beforeEach(() => {
        localStorage.clear(); // Clear mock storage before each test
    });

    // --- saveUserData Tests ---
    describe('saveUserData', () => {
        it('should save a valid Map to localStorage', () => {
            const usersMap = new Map([
                ['user1', { username: 'user1', mostRecentlySaidThings: ['hi'], lastSeenDate: '2024-01-01T00:00:00Z' }],
                ['user2', { username: 'user2', mostRecentlySaidThings: ['hello'], lastSeenDate: '2024-01-02T00:00:00Z' }],
            ]);
            saveUserData(usersMap);

            const storedData = localStorage.getItem(STORAGE_KEY);
            expect(storedData).not.toBeNull();
            const parsedData = JSON.parse(storedData);
            expect(parsedData).toHaveLength(2);
            expect(parsedData[0]).toEqual(['user1', { username: 'user1', mostRecentlySaidThings: ['hi'], lastSeenDate: '2024-01-01T00:00:00Z' }]);
            expect(parsedData[1]).toEqual(['user2', { username: 'user2', mostRecentlySaidThings: ['hello'], lastSeenDate: '2024-01-02T00:00:00Z' }]);
        });

        it('should limit mostRecentlySaidThings during save', () => {
            const longChat = Array(60).fill('message');
            const usersMap = new Map([
                ['user1', { username: 'user1', mostRecentlySaidThings: longChat, lastSeenDate: '2024-01-01T00:00:00Z' }],
            ]);
            saveUserData(usersMap);

            const storedData = localStorage.getItem(STORAGE_KEY);
            const parsedData = JSON.parse(storedData);
            expect(parsedData[0][1].mostRecentlySaidThings).toHaveLength(50);
        });

        it('should throw error if localStorage.setItem fails (e.g., quota)', () => {
            const usersMap = new Map([['user1', { username: 'user1' }]]);
            localStorage.simulateQuotaExceeded(); // Simulate error on next setItem
            expect(() => {
                saveUserData(usersMap);
            }).toThrow(/QuotaExceededError|limit reached/); // Match either mock error message
        });
    });

    // --- loadUserData Tests ---
    describe('loadUserData', () => {
        it('should load and parse valid data from localStorage', () => {
            const storedArray = [
                ['user1', { username: 'user1', data: 'abc' }],
                ['user2', { username: 'user2', data: 'def' }],
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storedArray));

            const loadedMap = loadUserData();
            expect(loadedMap).toBeInstanceOf(Map);
            expect(loadedMap.size).toBe(2);
            expect(loadedMap.get('user1')).toEqual({ username: 'user1', data: 'abc' });
            expect(loadedMap.get('user2')).toEqual({ username: 'user2', data: 'def' });
        });

        it('should return an empty Map if no data is stored', () => {
            const loadedMap = loadUserData();
            expect(loadedMap).toBeInstanceOf(Map);
            expect(loadedMap.size).toBe(0);
        });

        it('should return an empty Map if stored data is invalid JSON', () => {
            localStorage.setItem(STORAGE_KEY, 'invalid json');
            // Suppress console.error during this test if possible, or just expect it
            // Suppress console.error during this test
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const loadedMap = loadUserData();
            consoleErrorSpy.mockRestore(); // Restore console.error

            expect(loadedMap).toBeInstanceOf(Map);
            expect(loadedMap.size).toBe(0);
        });
    });

    // --- handleQuotaError Tests ---
    describe('handleQuotaError', () => {
        it('should remove older half of users based on lastSeenDate', () => {
            const usersMap = new Map([
                ['userOldest', { username: 'userOldest', lastSeenDate: '2024-01-01T00:00:00Z' }],
                ['userNewest', { username: 'userNewest', lastSeenDate: '2024-01-03T00:00:00Z' }],
                ['userMiddle', { username: 'userMiddle', lastSeenDate: '2024-01-02T00:00:00Z' }],
                ['userNullDate', { username: 'userNullDate', lastSeenDate: null }], // Should be treated as oldest
            ]);

            const reducedMap = handleQuotaError(usersMap);
            expect(reducedMap.size).toBe(2); // ceil(4/2) = 2
            expect(reducedMap.has('userNewest')).toBe(true);
            expect(reducedMap.has('userMiddle')).toBe(true);
            expect(reducedMap.has('userOldest')).toBe(false);
            expect(reducedMap.has('userNullDate')).toBe(false);
        });

         it('should handle odd number of users correctly', () => {
            const usersMap = new Map([
                ['user1', { username: 'user1', lastSeenDate: '2024-01-01T00:00:00Z' }],
                ['user3', { username: 'user3', lastSeenDate: '2024-01-03T00:00:00Z' }],
                ['user2', { username: 'user2', lastSeenDate: '2024-01-02T00:00:00Z' }],
            ]);

            const reducedMap = handleQuotaError(usersMap);
            expect(reducedMap.size).toBe(2); // ceil(3/2) = 2
            expect(reducedMap.has('user3')).toBe(true);
            expect(reducedMap.has('user2')).toBe(true);
            expect(reducedMap.has('user1')).toBe(false);
        });

        it('should return the original map if sorting/slicing fails (though unlikely)', () => {
            const usersMap = new Map([['user1', { username: 'user1' }]]);
            // Mock sort to throw an error
            // Mock sort to throw an error
            const sortSpy = jest.spyOn(Array.prototype, 'sort').mockImplementationOnce(() => {
                 throw new Error('Mock sort error');
            });
             // Suppress console.error during this test
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const reducedMap = handleQuotaError(usersMap);

            sortSpy.mockRestore(); // Restore sort
            consoleErrorSpy.mockRestore();

            expect(reducedMap).toBe(usersMap); // Should return original map on error
        });

         it('should handle an empty map', () => {
            const usersMap = new Map();
            const reducedMap = handleQuotaError(usersMap);
            expect(reducedMap.size).toBe(0);
        });
    });
});