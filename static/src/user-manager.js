// User management system for Broadcasting Real-Time Coach
// Tracks users and their interactions in the broadcast
import { validateImportData, createBackup, isFileSizeValid, mergeUsers } from './data-manager.js';

export class UserManager {
    constructor() {
        this.users = new Map();
        this.saveDebounceTimeout = null;
        this.maxChatHistory = 50; // Limit chat history per user
        this.loadUsers();
    }

    // Add a new user if they don't already exist
    addUser(username) {
        if (!username || typeof username !== 'string' || username === 'Anonymous') return;
        
        if (!this.users.has(username)) {
            const newUser = this.getDefaultUser(username);
            this.users.set(username, newUser);
            this.debouncedSave();
            return true;
        }
        return false;
    }

    // Update an existing user's information
    updateUser(username, updates) {
        if (!username || username === 'Anonymous') return false;
        
        let user = this.users.get(username);
        if (!user) {
            user = this.getDefaultUser(username);
            this.users.set(username, user);
        }
        
        // Special handling for chat messages
        if (updates.recentMessage) {
            user.mostRecentlySaidThings.unshift(updates.recentMessage);
            if (user.mostRecentlySaidThings.length > this.maxChatHistory) {
                user.mostRecentlySaidThings.pop();
            }
            delete updates.recentMessage;
        }
        
        // Handle tip updates
        if (updates.tipAmount) {
            user.amountTippedTotal += updates.tipAmount;
            user.mostRecentTipAmount = updates.tipAmount;
            user.mostRecentTipDatetime = new Date().toISOString();
            delete updates.tipAmount;
        }
        
        // Apply remaining updates
        Object.assign(user, updates);
        
        // Always update last seen date on any update
        user.lastSeenDate = new Date().toISOString();
        
        this.debouncedSave();
        return true;
    }

    // Get user by username
    getUser(username) {
        return this.users.get(username);
    }

    // Get all users, sorted by online status and then last seen date
    getAllUsers() {
        return Array.from(this.users.values()).sort((a, b) => {
            // Online users first
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            
            // Then sort by last seen date (most recent first)
            return new Date(b.lastSeenDate) - new Date(a.lastSeenDate);
        });
    }

    // Mark a user as active and online
    markUserActive(username) {
        return this.updateUser(username, { isOnline: true });
    }

    // Mark a user as online
    markUserOnline(username) {
        return this.markUserActive(username);
    }

    // Mark a user as offline
    markUserOffline(username) {
        return this.updateUser(username, { isOnline: false });
    }

    // Add a message to a user's recent messages
    addUserMessage(username, message) {
        return this.updateUser(username, { recentMessage: message });
    }

    // Record a tip from a user
    recordUserTip(username, amount) {
        return this.updateUser(username, { tipAmount: amount });
    }

    // Debounce save operations to avoid excessive localStorage writes
    debouncedSave() {
        clearTimeout(this.saveDebounceTimeout);
        this.saveDebounceTimeout = setTimeout(() => this.saveUsers(), 1000);
    }

    // Save all users to localStorage
    saveUsers() {
        try {
            const usersArray = Array.from(this.users).map(([key, value]) => {
                return [key, {
                    ...value,
                    // Ensure we don't store too many messages per user
                    mostRecentlySaidThings: value.mostRecentlySaidThings.slice(0, this.maxChatHistory)
                }];
            });
            localStorage.setItem('broadcastCoachUsers', JSON.stringify(usersArray));
        } catch (error) {
            console.error('Error saving users:', error);
            this.handleStorageError(error);
        }
    }

    // Handle localStorage errors
    handleStorageError(error) {
        if (error.name === 'QuotaExceededError') {
            // Implement cleanup strategy - remove half of the least recently seen users
            const sortedUsers = Array.from(this.users.entries())
                .sort((a, b) => new Date(a[1].lastSeenDate) - new Date(b[1].lastSeenDate));
            
            const usersToKeep = sortedUsers.slice(Math.floor(sortedUsers.length / 2));
            this.users = new Map(usersToKeep);
            this.saveUsers();
        }
    }

    // Load users from localStorage
    loadUsers() {
        try {
            const storedUsers = localStorage.getItem('broadcastCoachUsers');
            if (storedUsers) {
                const parsedUsers = JSON.parse(storedUsers);
                this.users = new Map(parsedUsers.map(([key, value]) => {
                    // Ensure all fields exist with proper defaults
                    return [key, {
                        ...this.getDefaultUser(key),
                        ...value,
                        // Reset online status on load
                        isOnline: false
                    }];
                }));
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.users = new Map();
        }
    }
    
    /**
     * Export all data as JSON
     * @param {Object} configData - Configuration data to include
     * @param {string} password - Password to encrypt the data with (can be null)
     * @returns {string} - JSON string of exported data
     */
    exportData(configData, password) {
        const data = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            users: this.getAllUsers(),
            settings: configData
        };
        let jsonData = JSON.stringify(data, null, 2);
        if (password) {
            jsonData = this.ProtectionEncode(jsonData, password);
        }
        return jsonData;
    }

    /**
     * Import data from JSON
     * @param {string} jsonData - JSON string to import
     * @param {Object} configState - Configuration state object to update
     * @param {boolean} merge - Whether to merge with existing data
     * @param {string} password - Password to decrypt the data with (can be null)
     * @returns {Object} - Result {success: boolean, message: string}
     */
    importData(jsonData, configState, merge = false, password) {
        try {
            let decryptedJson = jsonData;
            if (password) {
                // Decrypt the data
                decryptedJson = this.ProtectionDeEncode(jsonData, password);
            }

            // Check file size (approximate check based on string length)
            if (!isFileSizeValid(decryptedJson.length)) {
                return { success: false, message: 'File size exceeds 10MB limit' };
            }

            // Parse data
            const data = JSON.parse(decryptedJson);

            // Validate data structure
            const validation = validateImportData(data);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }
            
            // Create backup before import
            const backupData = this.getAllUsers();
            const backupConfig = { ...configState.config };
            const backup = createBackup(backupData, backupConfig);
            localStorage.setItem('broadcastCoachBackup', backup);
            
            if (merge) {
                // Merge users instead of replacing
                const currentUsers = this.getAllUsers();
                const mergedUsers = mergeUsers(currentUsers, data.users);
                
                // Clear existing data
                this.clearAllUsers();
                
                // Import merged users
                mergedUsers.forEach(user => this.addUserObject(user));
            } else {
                // Clear existing data
                this.clearAllUsers();
                
                // Import users
                data.users.forEach(user => this.addUserObject(user));
            }
            
            // Update settings
            configState.updateConfig(data.settings);
            
            return { success: true, message: 'Data imported successfully' };
        } catch (error) {
            console.error('Import failed:', error);
            return { success: false, message: `Import failed: ${error.message}` };
        }
    }
    
    /**
     * Add a user object directly (for import)
     * @param {Object} userObject - Complete user object
     * @returns {boolean} - Success status
     */
    addUserObject(userObject) {
        if (!userObject || !userObject.username) return false;
        
        this.users.set(userObject.username, {
            ...this.getDefaultUser(userObject.username),
            ...userObject,
            // Reset online status on import
            isOnline: false
        });
        
        this.debouncedSave();
        return true;
    }
    
    /**
     * Clear all user data
     * @returns {boolean} - Success status
     */
    clearAllUsers() {
        this.users = new Map();
        this.debouncedSave();
        return true;
    }
    
    /**
     * Restore from backup
     * @param {Object} configState - Configuration state object to update
     * @returns {Object} - Result {success: boolean, message: string}
     */
    restoreFromBackup(configState) {
        try {
            const backup = localStorage.getItem('broadcastCoachBackup');
            if (!backup) {
                return { success: false, message: 'No backup found' };
            }
            
            return this.importData(backup, configState);
        } catch (error) {
            console.error('Restore failed:', error);
            return { success: false, message: `Restore failed: ${error.message}` };
        }
    }

    // Default user object template
    getDefaultUser(username) {
        return {
            username,
            firstSeenDate: new Date().toISOString(),
            lastSeenDate: new Date().toISOString(),
            mostRecentlySaidThings: [],
            amountTippedTotal: 0,
            mostRecentTipAmount: 0,
            mostRecentTipDatetime: null,
            realName: null,
            realLocation: null,
            preferences: '',
            interests: '',
            numberOfPrivateShowsTaken: 0,
            isOnline: false
        };
    }

    ProtectionEncode(data, password) {
        this.xorEncode(data, password)
    }


    ProtectionDeEncode(data, password) {
        this.xorEncode(data, password)
    }

    // XOR encode/decode function
    xorEncode(data, password) {
        let encoded = "";
        for (let i = 0; i < data.length; i++) {
            encoded += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % password.length));
        }
        return encoded;
    }
}

export default UserManager;
