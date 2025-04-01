import test from 'node:test';
import assert from 'node:assert';
import { UserManager } from '../static/src/user-manager.js'; // Adjust path as needed

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

test.describe('UserManager - importTokenHistory', () => {
    let userManager;

    test.beforeEach(() => {
        localStorage.clear(); // Clear mock storage before each test
        userManager = new UserManager();
        // Ensure no users exist initially for clean tests
        assert.strictEqual(userManager.getAllUsers().length, 0, 'UserManager should be empty initially');
    });

    test('should import regular tips correctly', () => {
        const csvData = `User,Token change,Timestamp,Note
user1,10,2024-01-01T10:00:00Z,Tip 1
user2,20,2024-01-01T10:01:00Z,Tip 2
user1,5,2024-01-01T10:02:00Z,Tip 3`;

        const result = userManager.importTokenHistory(csvData);
        assert.strictEqual(result.success, true, 'Import should be successful');
        assert.strictEqual(result.stats.users, 2, 'Should report 2 unique users');
        assert.strictEqual(result.stats.tokens, 35, 'Should report 35 total tokens'); // 10 + 20 + 5

        const user1 = userManager.getUser('user1');
        const user2 = userManager.getUser('user2');

        assert.ok(user1, 'User1 should exist');
        assert.ok(user2, 'User2 should exist');
        assert.strictEqual(user1.eventHistory.length, 2, 'User1 should have 2 events');
        assert.strictEqual(user2.eventHistory.length, 1, 'User2 should have 1 event');
        assert.strictEqual(user1.eventHistory[0].type, 'tip', 'User1 last event should be tip');
        assert.strictEqual(user1.eventHistory[0].data.amount, 5, 'User1 last tip amount should be 5');
        assert.strictEqual(user1.eventHistory[1].data.amount, 10, 'User1 first tip amount should be 10');
        assert.strictEqual(user2.eventHistory[0].data.amount, 20, 'User2 tip amount should be 20');
        assert.strictEqual(user1.tokenStats.totalSpent, 15, 'User1 total spent should be 15');
        assert.strictEqual(user2.tokenStats.totalSpent, 20, 'User2 total spent should be 20');
    });

    test('should skip duplicate entries', () => {
        // Add an initial event using the same timestamp format as the import process
        const initialTimestamp = new Date('2024-01-01T10:00:00Z').toISOString();
        userManager.addEvent('user1', 'tip', { amount: 10, timestamp: initialTimestamp });
        
        const csvData = `User,Token change,Timestamp,Note
user1,10,2024-01-01T10:00:00Z,Duplicate Tip 1 // Exact duplicate
user1,20,2024-01-01T10:01:00Z,New Tip 2`;

        const result = userManager.importTokenHistory(csvData);
        assert.strictEqual(result.success, true, 'Import should be successful');
        assert.strictEqual(result.stats.tokens, 20, 'Should report only 20 new tokens'); // Only New Tip 2

        const user1 = userManager.getUser('user1');
        assert.ok(user1, 'User1 should exist');
        // Should have the initial event + the new one (2 total)
        assert.strictEqual(user1.eventHistory.length, 2, 'User1 should have 2 events (initial + new)'); 
        assert.strictEqual(user1.eventHistory[0].data.amount, 20, 'User1 newest event amount should be 20');
        assert.strictEqual(user1.eventHistory[1].data.amount, 10, 'User1 oldest event amount should be 10');
        assert.strictEqual(user1.tokenStats.totalSpent, 30, 'User1 total spent should be 30 (10 + 20)');
    });

    test('should generate privateShow meta events correctly', () => {
        const csvData = `User,Token change,Timestamp,Note
user3,10,2024-01-01T11:00:00Z,Private Show Started
user3,10,2024-01-01T11:00:10Z,Private Show
user3,10,2024-01-01T11:00:20Z,Private Show Ended // 20s duration
user3,5,2024-01-01T11:01:00Z,Regular Tip`; // Separate tip after show

        const result = userManager.importTokenHistory(csvData);
        assert.strictEqual(result.success, true, 'Import should be successful');
        // Tokens = 30 from show + 5 from tip
        assert.strictEqual(result.stats.tokens, 35, 'Should report 35 total tokens (show + tip)'); 

        const user3 = userManager.getUser('user3');
        assert.ok(user3, 'User3 should exist');
        // Should have 1 meta event + 1 tip event = 2 events
        assert.strictEqual(user3.eventHistory.length, 2, 'User3 should have 2 events (meta + tip)'); 
        
        const metaEvent = user3.eventHistory.find(e => e.type === 'privateShow');
        const tipEvent = user3.eventHistory.find(e => e.type === 'tip');

        assert.ok(metaEvent, 'privateShow meta event should exist');
        assert.ok(tipEvent, 'Regular tip event should exist');

        assert.strictEqual(metaEvent.data.tokens, 30, 'Meta event total tokens should be 30');
        assert.strictEqual(metaEvent.data.amount, 30, 'Meta event amount should be 30');
        assert.strictEqual(metaEvent.data.duration, 20, 'Meta event duration should be 20 seconds');
        assert.strictEqual(metaEvent.data.startTime, '2024-01-01T11:00:00.000Z', 'Meta event start time incorrect');
        assert.strictEqual(metaEvent.data.endTime, '2024-01-01T11:00:20.000Z', 'Meta event end time incorrect');
        
        assert.strictEqual(tipEvent.data.amount, 5, 'Tip event amount should be 5');
        assert.strictEqual(user3.tokenStats.totalSpent, 35, 'User3 total spent should be 35');
    });
    
    test('should generate privateShowSpy meta events correctly', () => {
        const csvData = `User,Token change,Timestamp,Note
user4,5,2024-01-01T12:00:00Z,Spy Show Started
user4,5,2024-01-01T12:00:10Z,Spy Show Ended`; // 10s duration

        const result = userManager.importTokenHistory(csvData);
        assert.strictEqual(result.success, true, 'Import should be successful');
        assert.strictEqual(result.stats.tokens, 10, 'Should report 10 total tokens'); 

        const user4 = userManager.getUser('user4');
        assert.ok(user4, 'User4 should exist');
        assert.strictEqual(user4.eventHistory.length, 1, 'User4 should have 1 meta event'); 
        
        const metaEvent = user4.eventHistory[0];
        assert.strictEqual(metaEvent.type, 'privateShowSpy', 'Event type should be privateShowSpy');
        assert.strictEqual(metaEvent.data.tokens, 10, 'Meta event total tokens should be 10');
        assert.strictEqual(metaEvent.data.duration, 10, 'Meta event duration should be 10 seconds');
    });

    test('should handle multiple private shows for the same user', () => {
        const csvData = `User,Token change,Timestamp,Note
user5,10,2024-01-01T13:00:00Z,Private Show
user5,10,2024-01-01T13:00:10Z,Private Show // Show 1 ends
user5,20,2024-01-01T13:01:00Z,Private Show // Show 2 starts (gap > 30s)
user5,20,2024-01-01T13:01:10Z,Private Show`; // Show 2 ends

        const result = userManager.importTokenHistory(csvData);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.stats.tokens, 60); // 20 + 40

        const user5 = userManager.getUser('user5');
        assert.ok(user5);
        assert.strictEqual(user5.eventHistory.length, 2, 'User5 should have 2 meta events');
        
        const show1 = user5.eventHistory.find(e => e.data.startTime === '2024-01-01T13:00:00.000Z');
        const show2 = user5.eventHistory.find(e => e.data.startTime === '2024-01-01T13:01:00.000Z');

        assert.ok(show1, 'Show 1 meta event missing');
        assert.ok(show2, 'Show 2 meta event missing');
        assert.strictEqual(show1.data.tokens, 20);
        assert.strictEqual(show1.data.duration, 10);
        assert.strictEqual(show2.data.tokens, 40);
        assert.strictEqual(show2.data.duration, 10);
        assert.strictEqual(user5.tokenStats.totalSpent, 60);
    });

    test('should handle mixed tips and private shows', () => {
        const csvData = `User,Token change,Timestamp,Note
user6,5,2024-01-01T14:00:00Z,Tip 1
user6,10,2024-01-01T14:00:30Z,Private Show
user6,10,2024-01-01T14:00:40Z,Private Show
user6,7,2024-01-01T14:01:00Z,Tip 2`;

        const result = userManager.importTokenHistory(csvData);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.stats.tokens, 32); // 5 + 20 + 7

        const user6 = userManager.getUser('user6');
        assert.ok(user6);
        // 1 tip, 1 meta, 1 tip = 3 events
        assert.strictEqual(user6.eventHistory.length, 3, 'User6 should have 3 events'); 
        
        const metaEvent = user6.eventHistory.find(e => e.type === 'privateShow');
        assert.ok(metaEvent);
        assert.strictEqual(metaEvent.data.tokens, 20);
        assert.strictEqual(metaEvent.data.duration, 10);
        
        const tips = user6.eventHistory.filter(e => e.type === 'tip');
        assert.strictEqual(tips.length, 2, 'Should have 2 tip events');
        assert.strictEqual(user6.tokenStats.totalSpent, 32);
    });

});
