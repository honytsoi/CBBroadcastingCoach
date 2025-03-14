// Data management for Broadcasting Real-Time Coach
// Handles export/import functionality

/**
 * Validates imported data structure
 * @param {Object} data - The parsed JSON data
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
export function validateImportData(data) {
    if (!data) {
        return {valid: false, error: 'No data provided'};
    }

    // Check version
    if (!data.version || data.version !== '1.0') {
        return {valid: false, error: 'Invalid data version. Expected: 1.0'};
    }

    // Check timestamp
    if (!data.timestamp || !isValidISODate(data.timestamp)) {
        return {valid: false, error: 'Invalid or missing timestamp'};
    }

    // Check users array
    if (!Array.isArray(data.users)) {
        return {valid: false, error: 'Users data must be an array'};
    }

    // Check settings object
    if (!data.settings || typeof data.settings !== 'object') {
        return {valid: false, error: 'Settings data must be an object'};
    }

    // Required settings fields
    const requiredSettingsFields = ['broadcasterName', 'promptLanguage', 'promptDelay', 'scannedUrl'];
    const missingSettings = requiredSettingsFields.filter(field => !data.settings.hasOwnProperty(field));
    if (missingSettings.length > 0) {
        return {valid: false, error: `Missing required settings: ${missingSettings.join(', ')}`};
    }

    // Validate each user
    for (let i = 0; i < data.users.length; i++) {
        const user = data.users[i];
        const userValidation = validateUserData(user);
        if (!userValidation.valid) {
            return {valid: false, error: `Invalid user at index ${i}: ${userValidation.error}`};
        }
    }

    return {valid: true};
}

/**
 * Validates user data
 * @param {Object} user - The user object
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
function validateUserData(user) {
    // Required user fields with their expected types
    const requiredFields = {
        'username': 'string',
        'firstSeenDate': 'isodate',
        'lastSeenDate': 'isodate',
        'mostRecentlySaidThings': 'array',
        'amountTippedTotal': 'number',
        'mostRecentTipAmount': 'number',
        'mostRecentTipDatetime': 'isodate|null',
        'realName': 'string|null',
        'realLocation': 'string|null',
        'preferences': 'string|null',
        'interests': 'string|null',
        'numberOfPrivateShowsTaken': 'number',
        'isOnline': 'boolean'
    };

    // Check each required field
    for (const [field, type] of Object.entries(requiredFields)) {
        // Check if field exists
        if (!user.hasOwnProperty(field)) {
            return {valid: false, error: `Missing required field: ${field}`};
        }

        // Check field type
        if (!isValidFieldType(user[field], type)) {
            return {valid: false, error: `Invalid type for field ${field}. Expected: ${type}, Got: ${typeof user[field]}`};
        }
    }

    return {valid: true};
}

/**
 * Checks if a value matches the expected type
 * @param {any} value - The value to check
 * @param {string} type - The expected type
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidFieldType(value, type) {
    // Handle null values for nullable types
    if (value === null && type.includes('null')) {
        return true;
    }

    // Check against possible types
    const types = type.split('|');
    for (const t of types) {
        switch (t) {
            case 'string':
                if (typeof value === 'string') return true;
                break;
            case 'number':
                if (typeof value === 'number') return true;
                break;
            case 'boolean':
                if (typeof value === 'boolean') return true;
                break;
            case 'array':
                if (Array.isArray(value)) return true;
                break;
            case 'isodate':
                if (isValidISODate(value)) return true;
                break;
        }
    }

    return false;
}

/**
 * Checks if a string is a valid ISO date
 * @param {string} dateString - The date string to check
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidISODate(dateString) {
    if (typeof dateString !== 'string') return false;
    
    // Allow null for optional date fields
    if (dateString === null) return true;
    
    // Try parsing the date
    const date = new Date(dateString);
    return !isNaN(date) && dateString.includes('T');
}

/**
 * Creates a backup of current data
 * @param {Object} userData - User data to backup
 * @param {Object} configData - Config data to backup
 * @returns {string} - JSON string of backup data
 */
export function createBackup(userData, configData) {
    const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        users: userData,
        settings: configData,
        backupType: 'pre-import'
    };
    
    return JSON.stringify(backup, null, 2);
}

/**
 * Checks if a file size is within the limit
 * @param {number} size - File size in bytes
 * @param {number} limit - Size limit in bytes (default: 10MB)
 * @returns {boolean} - True if within limit, false otherwise
 */
export function isFileSizeValid(size, limit = 10 * 1024 * 1024) {
    return size <= limit;
}

/**
 * Merge imported users with existing users
 * @param {Array} existingUsers - Array of existing user objects
 * @param {Array} importedUsers - Array of imported user objects
 * @returns {Array} - Merged user array
 */
export function mergeUsers(existingUsers, importedUsers) {
    const mergedUsers = [...existingUsers];
    const existingUsernames = new Set(existingUsers.map(user => user.username));
    
    // Process each imported user
    for (const importedUser of importedUsers) {
        if (existingUsernames.has(importedUser.username)) {
            // Update existing user
            const existingIndex = mergedUsers.findIndex(u => u.username === importedUser.username);
            const existingUser = mergedUsers[existingIndex];
            
            // Keep most recent data
            const merged = {
                ...existingUser,
                ...importedUser,
                // Special handling for arrays and incrementing values
                mostRecentlySaidThings: [...new Set([...importedUser.mostRecentlySaidThings, ...existingUser.mostRecentlySaidThings])],
                amountTippedTotal: Math.max(existingUser.amountTippedTotal, importedUser.amountTippedTotal),
                // Use newer date
                lastSeenDate: new Date(existingUser.lastSeenDate) > new Date(importedUser.lastSeenDate) 
                    ? existingUser.lastSeenDate : importedUser.lastSeenDate
            };
            
            mergedUsers[existingIndex] = merged;
        } else {
            // Add new user
            mergedUsers.push(importedUser);
            existingUsernames.add(importedUser.username);
        }
    }
    
    return mergedUsers;
}
