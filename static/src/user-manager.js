// User management system for Broadcasting Real-Time Coach
// Tracks users and their interactions in the broadcast
import { validateImportData, createBackup, isFileSizeValid, mergeUsers } from './data-manager.js';
import { displayError } from './displayError.js';
import { saveUserData, loadUserData, handleQuotaError } from './storage-manager.js';
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

        // lastSeenDate is now updated by addEvent based on event timestamps
        // user.lastSeenDate = new Date().toISOString(); 

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
        // Note: We still call updateUser for backward compatibility with old tip tracking,
        // but the primary record is now the eventHistory.
        // This updateUser call might be removed later if old fields are fully deprecated.
        this.updateUser(username, { tipAmount: amount }); 
        return true; // Indicate success based on addEvent
    }

    // Record media purchase
    recordMediaPurchase(username, item, price) {
        return this.addEvent(username, 'mediaPurchase', { item, amount: price });
    }

    // Record user entering the room
    recordUserEnter(username) {
        this.markUserOnline(username); // Also mark as online
        return this.addEvent(username, 'userEnter');
    }

    // Record user leaving the room
    recordUserLeave(username) {
        this.markUserOffline(username); // Also mark as offline
        return this.addEvent(username, 'userLeave');
    }

    // Record user following
    recordFollow(username) {
        return this.addEvent(username, 'follow');
    }

    // Record user unfollowing
    recordUnfollow(username) {
        return this.addEvent(username, 'unfollow');
    }

    // Record broadcast start
    recordBroadcastStart() {
        // Use 'broadcast' as username for system events
        return this.addEvent('broadcast', 'broadcastStart');
    }

    // Record broadcast stop
    recordBroadcastStop() {
        // Use 'broadcast' as username for system events
        return this.addEvent('broadcast', 'broadcastStop');
    }

    // Record fanclub join
    recordFanclubJoin(username) {
        // Mark fanClubMember as true in the event data
        return this.addEvent(username, 'fanclubJoin', { fanClubMember: true });
        // TODO: Need a way to handle fanclub leave/expiry
    }

    // Record room subject change
    recordRoomSubjectChange(subject) {
        // Use 'broadcast' as username for system events
        return this.addEvent('broadcast', 'roomSubjectChange', { subject });
    }

    // Debounce save operations to avoid excessive localStorage writes
    debouncedSave() {
        clearTimeout(this.saveDebounceTimeout);
        this.saveDebounceTimeout = setTimeout(() => this.saveUsers(), 1000);
    }

    // Save all users using the storage manager
    saveUsers() {
        try {
            // Delegate saving logic to storage-manager
            saveUserData(this.users);
        } catch (error) {
            console.error('Error saving users via storage manager:', error);
            // Check if it's a quota error and handle it
            if (error.name === 'QuotaExceededError' || (error.message && error.message.toLowerCase().includes('quota'))) {
                try {
                    console.warn('Attempting quota error handling...');
                    const reducedUsersMap = handleQuotaError(this.users);
                    // Assign the reduced map back to this.users
                    this.users = reducedUsersMap;
                    // Attempt to save the reduced map
                    console.log('Retrying save after quota handling...');
                    saveUserData(this.users);
                    console.log('Successfully saved reduced user data after quota error.');
                } catch (retryError) {
                    console.error('Failed to save even after handling quota error:', retryError);
                    // Optionally display a persistent error to the user here
                    displayError(new Error("Failed to save user data due to storage limits, even after cleanup. Some data might be lost."));
                }
            } else {
                // Handle other potential save errors
                 displayError(new Error(`An unexpected error occurred while saving user data: ${error.message}`));
            }
        }
    }

    // Removed handleStorageError method - logic moved to storage-manager.js and saveUsers catch block

    // Load users using the storage manager
    loadUsers() {
        try {
            // Delegate loading logic to storage-manager
            const loadedMap = loadUserData();

            // Process the loaded map: merge with defaults and reset online status
            const processedUsers = new Map();
            for (const [key, value] of loadedMap.entries()) {
                 processedUsers.set(key, {
                    ...this.getDefaultUser(key), // Apply defaults first
                    ...value,                   // Override with loaded data
                    isOnline: false             // Ensure online status is reset
                });
            }
            this.users = processedUsers;

        } catch (error) {
            // loadUserData already logs errors, but we catch any unexpected issues here
            console.error('Critical error during user loading process:', error);
            this.users = new Map(); // Ensure users is a valid Map on failure
            displayError(new Error("Failed to load user data. Starting with a clean slate."));
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
            firstSeenDate: null, // Will be set by the first event
            lastSeenDate: null,  // Will be set by the latest event
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

        // Use provided timestamp if available (for imports), else use current time
        const eventTimestamp = data.timestamp || new Date().toISOString();

        let user = this.getUser(username);
        let isNewUser = false;
        if (!user) {
            user = this.getDefaultUser(username);
            isNewUser = true;
        }
        
        // Update firstSeenDate for new users or if it's null
        if (isNewUser || user.firstSeenDate === null) {
            user.firstSeenDate = eventTimestamp;
        }

        // Update lastSeenDate if this event is newer or if lastSeenDate is null
        if (user.lastSeenDate === null || new Date(eventTimestamp) > new Date(user.lastSeenDate)) {
            user.lastSeenDate = eventTimestamp;
        }

        this.users.set(username, user);

        // Create new event
        const event = {
            username,
            type,
            timestamp: eventTimestamp, 
            data: {
                note: data.note || null,
                amount: data.amount || null,
                content: data.content || null,
                isPrivate: data.isPrivate || null,
                fanClubMember: data.fanClubMember || null,
                item: data.item || null,
                subject: data.subject || null,
                // Include duration, tokens, startTime, endTime for meta events if present
                duration: data.duration, 
                tokens: data.tokens,
                startTime: data.startTime,
                endTime: data.endTime
            }
        };
        // Remove the timestamp from data if it existed, so it's not duplicated
        delete data.timestamp; 

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
     * Get total tokens spent by a user
     * @param {string} username 
     * @returns {number} Total tokens spent
     */
    getTotalSpent(username) {
        return this.getUser(username)?.tokenStats.totalSpent || 0;
    }

    /**
     * Get tokens spent by a user in a specific period for a category
     * @param {string} username 
     * @param {number} days - Number of days (e.g., 7, 30)
     * @param {string} category - 'tips', 'privates', or 'media'
     * @returns {number} Tokens spent in the period for the category
     */
    getSpentInPeriod(username, days, category) {
        const user = this.getUser(username);
        if (!user) return 0;

        if (days === 7) return user.tokenStats.timePeriods.day7[category] || 0;
        if (days === 30) return user.tokenStats.timePeriods.day30[category] || 0;

        // Fallback to full scan for custom periods
        return this.calculateCustomPeriodTotal(user, days, category);
    }

    /**
     * Helper to calculate totals for custom time periods by scanning event history
     * @param {Object} user 
     * @param {number} days 
     * @param {string} category - 'tips', 'privates', or 'media'
     * @returns {number} Total tokens for the custom period and category
     */
    calculateCustomPeriodTotal(user, days, category) {
        let total = 0;
        const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

        user.eventHistory.forEach(event => {
            if (event.data.amount && new Date(event.timestamp) >= cutoffDate) {
                const eventCategory = event.type === 'privateMessage' || event.type === 'privateShow' ? 'privates' :
                                      event.type === 'mediaPurchase' ? 'media' : 'tips';
                if (eventCategory === category) {
                    total += event.data.amount;
                }
            }
        });
        return total;
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

            // --- Refactored Import Logic ---
            const regularTipsToAdd = [];
            const privateShowSequences = {};
            let importedUsers = new Set(); // Track users involved

            // 1. First Pass: Parse rows, check duplicates, separate tips & private/spy entries
            for (const row of rows) {
                if (!row.User || !row['Token change'] || !row.Timestamp) continue; // Skip invalid rows

                const username = row.User.trim();
                const amount = parseFloat(row['Token change']);
                const note = row.Note ? row.Note.trim() : null;
                const timestamp = new Date(row.Timestamp).toISOString();

                if (isNaN(amount) || amount <= 0) continue; // Use continue instead of return inside forEach

                // --- Duplicate Check (against existing history) ---
                const user = this.getUser(username);
                let isDuplicate = false;
                if (user) {
                    // Check against existing history for the same user, timestamp, and amount
                    isDuplicate = user.eventHistory.some(event => {
                        // Ensure timestamp and amount comparison is robust
                        const eventAmount = event.data.amount !== null && event.data.amount !== undefined ? Number(event.data.amount) : NaN;
                        const csvAmount = Number(amount); // amount is already parsed float
                        return event.timestamp === timestamp && eventAmount === csvAmount;
                    });
                }
                if (isDuplicate) {
                    // console.log('Skipping duplicate entry (already exists):', { username, timestamp, amount });
                    continue; 
                }
                // --- End Duplicate Check ---

                // Separate regular tips from private/spy entries
                if (note && (note.includes('Private') || note.includes('Spy'))) {
                    // Group private/spy entries by user
                    if (!privateShowSequences[username]) {
                        privateShowSequences[username] = [];
                    }
                    privateShowSequences[username].push({ amount, timestamp, isSpy: note.includes('Spy') });
                } else {
                    // Store regular tips temporarily
                    regularTipsToAdd.push({ 
                        username, 
                        type: 'tip', 
                        timestamp, // Keep timestamp for sorting later
                        data: { amount, note } 
                    });
                }
                importedUsers.add(username); // Track unique users processed
            } // End of first pass loop

            // 2. Second Pass: Process sequences and generate meta events
            const metaEventsToAdd = [];
            Object.entries(privateShowSequences).forEach(([username, entries]) => {
                if (entries.length === 0) return;

                // Sort user's private/spy entries by timestamp
                entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Group entries into distinct shows based on time gap
                let currentShow = [];
                const shows = []; // Array to hold groups of entries representing single shows

                entries.forEach((entry, i) => {
                    // Start a new show if it's the first entry or if the gap is > 30 seconds
                    if (i > 0) {
                        const prevTime = new Date(entries[i - 1].timestamp);
                        const currTime = new Date(entry.timestamp);
                        const gap = (currTime - prevTime) / 1000; // Gap in seconds
                        
                        if (gap > 30) {
                            // If gap is too large, finalize the previous show and start a new one
                            if (currentShow.length > 0) shows.push(currentShow);
                            currentShow = []; // Start a new show group
                        }
                    }
                    currentShow.push(entry); // Add entry to the current show group
                });
                // Add the last show group if it has entries
                if (currentShow.length > 0) shows.push(currentShow);

                // Generate meta events from the grouped shows
                shows.forEach(showEntries => {
                    if (showEntries.length === 0) return;

                    const firstEntry = showEntries[0];
                    const lastEntry = showEntries[showEntries.length - 1];
                    const isSpy = firstEntry.isSpy; // Determine if it was a spy show
                    const totalTokens = showEntries.reduce((sum, e) => sum + e.amount, 0);
                    // Calculate duration in seconds
                    const duration = Math.max(0, (new Date(lastEntry.timestamp) - new Date(firstEntry.timestamp)) / 1000); 

                    // Store meta event temporarily
                    metaEventsToAdd.push({
                        username,
                        type: isSpy ? 'privateShowSpy' : 'privateShow',
                        timestamp: firstEntry.timestamp, // Use start time for sorting
                        data: {
                            duration,
                            tokens: totalTokens, // As per plan
                            amount: totalTokens, // For compatibility with updateTokenStats
                            startTime: firstEntry.timestamp,
                            endTime: lastEntry.timestamp
                        }
                    });
                });
            }); // End processing sequences

            // 3. Third Pass: Add all collected events (regular tips + meta events)
            const allEventsToAdd = [...regularTipsToAdd, ...metaEventsToAdd];
            // Sort all events by timestamp before adding
            allEventsToAdd.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            let addedTokensCount = 0;
            for (const eventData of allEventsToAdd) {
                // Add the event using the base handler
                // Pass the original timestamp within the data object
                const dataWithTimestamp = { 
                    ...eventData.data, 
                    timestamp: eventData.timestamp // Ensure original timestamp is passed
                };
                this.addEvent(eventData.username, eventData.type, dataWithTimestamp);
                
                // Accumulate token count for the final message
                addedTokensCount += eventData.data.amount || 0; // Use amount from original data
            }

            // Final result message
            const finalTokenCount = addedTokensCount;
            const finalUserCount = importedUsers.size;

            return { 
                success: true, 
                message: `Imported ${finalTokenCount} tokens across ${finalUserCount} users.`,
                stats: {
                    users: finalUserCount, // Use the count of unique users processed
                    tokens: finalTokenCount // Use the count of tokens actually added
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
