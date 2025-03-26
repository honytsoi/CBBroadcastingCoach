// User management system for Broadcasting Real-Time Coach
// Tracks users and their interactions in the broadcast
import { validateImportData, createBackup, isFileSizeValid, mergeUsers } from './data-manager.js';
import { displayError } from './displayError.js';
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
    addUserMessage(username, message, isPrivate = false) {
        const type = isPrivate ? 'privateMessage' : 'chatMessage';
        this.addEvent(username, type, { 
            content: message,
            isPrivate 
        });
        return this.updateUser(username, { recentMessage: message });
    }

    // Record a tip from a user
    recordUserTip(username, amount, note = null) {
        this.addEvent(username, 'tip', { amount, note });
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
        let decryptedJson = jsonData;
        try {
            if (password) {
                // Decrypt the data
                decryptedJson = this.ProtectionDeEncode(jsonData, password);
            }
        } catch (error) {
            if (error.message === "Decryption failed. Incorrect password?") {
                displayError(new Error("Decryption failed. Incorrect password provided."));
                return { success: false, message: "Decryption failed. Incorrect password provided." };
            } else {
                console.error('Import failed:', error);
                return { success: false, message: `Import failed: ${error.message}` };
            }
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
            isOnline: false,
            // New event history structure
            eventHistory: [],
            tokenStats: {
                username,
                totalSpent: 0,
                lastUpdated: new Date().toISOString(),
                timePeriods: {
                    day7: {
                        tips: 0,
                        privates: 0,
                        media: 0
                    },
                    day30: {
                        tips: 0,
                        privates: 0,
                        media: 0
                    }
                }
            },
            maxHistory: 1000
        };
    }

    /**
     * Base event handler
     * @param {string} username - User who triggered the event
     * @param {string} type - Event type (see supported types)
     * @param {Object} data - Event-specific data
     * @returns {boolean} - Success status
     */
    addEvent(username, type, data = {}) {
        if (!username || !type) return false;

        const user = this.getUser(username) || this.getDefaultUser(username);
        this.users.set(username, user);

        // Create new event
        const event = {
            username,
            type,
            timestamp: new Date().toISOString(),
            data: {
                note: data.note || null,
                amount: data.amount || null,
                content: data.content || null,
                isPrivate: data.isPrivate || null,
                fanClubMember: data.fanClubMember || null,
                item: data.item || null,
                subject: data.subject || null
            }
        };

        // Add to history
        user.eventHistory.unshift(event);
        
        // Enforce max history limit
        if (user.eventHistory.length > user.maxHistory) {
            user.eventHistory.pop();
        }

        // Update aggregates if this is a token-related event
        if (data.amount) {
            this.updateTokenStats(user, event);
        }

        this.debouncedSave();
        return true;
    }

    /**
     * Update token stats when a token-related event occurs
     * @param {Object} user - User object
     * @param {Object} event - The event being added
     */
    updateTokenStats(user, event) {
        const amount = event.data.amount || 0;
        
        // Update total spent
        user.tokenStats.totalSpent += amount;
        user.tokenStats.lastUpdated = new Date().toISOString();

        // Update time periods if within range
        const eventDate = new Date(event.timestamp);
        const daysAgo = (Date.now() - eventDate) / (1000 * 60 * 60 * 24);
        
        if (daysAgo <= 7) {
            this.updateTimePeriod(user.tokenStats.timePeriods.day7, event.type, amount);
        }
        if (daysAgo <= 30) {
            this.updateTimePeriod(user.tokenStats.timePeriods.day30, event.type, amount);
        }
    }

    /**
     * Update a specific time period stats
     * @param {Object} period - The time period object (day7 or day30)
     * @param {string} type - Event type
     * @param {number} amount - Token amount
     */
    updateTimePeriod(period, type, amount) {
        // Group similar event types
        const category = type === 'privateMessage' || type === 'privateShow' ? 'privates' :
                        type === 'mediaPurchase' ? 'media' : 'tips';
        
        period[category] = (period[category] || 0) + amount;
    }

    /**
     * Recalculate all token stats from event history
     * @param {Object} user - User object to recalculate
     */
    recalculateTotals(user) {
        // Reset all totals
        user.tokenStats = {
            username: user.username,
            totalSpent: 0,
            lastUpdated: new Date().toISOString(),
            timePeriods: {
                day7: { tips: 0, privates: 0, media: 0 },
                day30: { tips: 0, privates: 0, media: 0 }
            }
        };

        // Process all relevant events
        user.eventHistory.forEach(event => {
            if (event.data.amount) {
                this.updateTokenStats(user, event);
            }
        });
    }

    /**
     * Import token history from CSV
     * @param {string} csvData - CSV string to import
     * @returns {Object} - Result {success: boolean, message: string, stats: {users: number, tokens: number}}
     */
    importTokenHistory(csvData) {
        try {
            // Parse CSV using PapaParse if available, or simple split as fallback
            const rows = typeof Papa !== 'undefined' ? 
                Papa.parse(csvData, { header: true }).data :
                this.simpleCSVParse(csvData);

            if (!rows || rows.length === 0) {
                return { success: false, message: 'No valid data found in CSV' };
            }

            const requiredFields = ['User', 'Token change', 'Timestamp'];
            if (!requiredFields.every(field => Object.keys(rows[0]).includes(field))) {
                return { success: false, message: 'CSV missing required fields' };
            }

            // Process rows and track private show sequences
            const privateShowSequences = {};
            let importedTokens = 0;
            let importedUsers = new Set();

            rows.forEach(row => {
                if (!row.User || !row['Token change'] || !row.Timestamp) return;

                const username = row.User.trim();
                const amount = parseFloat(row['Token change']);
                const note = row.Note ? row.Note.trim() : null;
                const timestamp = new Date(row.Timestamp).toISOString();

                if (isNaN(amount) || amount <= 0) return;

                // Check for private show entries (occurring every ~10 seconds)
                if (note && (note.includes('Private') || note.includes('Spy'))) {
                    if (!privateShowSequences[username]) {
                        privateShowSequences[username] = [];
                    }
                    privateShowSequences[username].push({
                        amount,
                        timestamp,
                        isSpy: note.includes('Spy')
                    });
                } else {
                    // Regular tip
                    this.addEvent(username, 'tip', {
                        amount,
                        note,
                        timestamp
                    });
                    importedUsers.add(username);
                    importedTokens += amount;
                }
            });

            // Process private show sequences into meta events
            Object.entries(privateShowSequences).forEach(([username, entries]) => {
                if (entries.length === 0) return;

                // Sort by timestamp (oldest first)
                entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Group into shows (gap >30s starts new show)
                let currentShow = [];
                const shows = [];

                entries.forEach((entry, i) => {
                    if (i > 0) {
                        const prevTime = new Date(entries[i-1].timestamp);
                        const currTime = new Date(entry.timestamp);
                        const gap = (currTime - prevTime) / 1000;
                        
                        if (gap > 30) {
                            shows.push(currentShow);
                            currentShow = [];
                        }
                    }
                    currentShow.push(entry);
                });
                if (currentShow.length > 0) shows.push(currentShow);

                // Create meta events
                shows.forEach(showEntries => {
                    if (showEntries.length === 0) return;

                    const firstEntry = showEntries[0];
                    const lastEntry = showEntries[showEntries.length - 1];
                    const isSpy = firstEntry.isSpy;
                    const totalTokens = showEntries.reduce((sum, e) => sum + e.amount, 0);
                    const duration = (new Date(lastEntry.timestamp) - new Date(firstEntry.timestamp)) / 1000;

                    this.addEvent(username, isSpy ? 'privateShowSpy' : 'privateShow', {
                        duration,
                        tokens: totalTokens,
                        startTime: firstEntry.timestamp,
                        endTime: lastEntry.timestamp
                    });

                    importedUsers.add(username);
                    importedTokens += totalTokens;
                });
            });

            return { 
                success: true, 
                message: `Imported ${importedTokens} tokens from ${importedUsers.size} users`,
                stats: {
                    users: importedUsers.size,
                    tokens: importedTokens
                }
            };

        } catch (error) {
            console.error('CSV import failed:', error);
            return { 
                success: false, 
                message: `CSV import failed: ${error.message}` 
            };
        }
    }

    /**
     * Simple CSV parser fallback when PapaParse not available
     * @param {string} csvData 
     * @returns {Array} Parsed rows
     */
    simpleCSVParse(csvData) {
        const lines = csvData.split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, i) => {
                obj[header] = values[i] ? values[i].trim() : '';
                return obj;
            }, {});
        });
    }

    ProtectionEncode(data, password) {
        const ciphertext = CryptoJS.AES.encrypt(data, password).toString();
        return ciphertext;
    }

    ProtectionDeEncode(data, password) {
        try {
            const bytes = CryptoJS.AES.decrypt(data, password);
            const plaintext = bytes.toString(CryptoJS.enc.Utf8);
            return plaintext;
        } catch (e) {
            console.error("Decryption error:", e);
            throw new Error("Decryption failed. Incorrect password?");
        }
    }

};

export default UserManager;
