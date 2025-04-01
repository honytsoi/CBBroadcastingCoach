// storage-manager.js
// This module handles interactions with the browser's storage (currently localStorage)
// for user data persistence.

const STORAGE_KEY = 'broadcastCoachUsers';

/**
 * Saves the user data Map to localStorage.
 * Converts the Map to an array of key-value pairs for storage.
 * @param {Map<string, object>} usersMap - The Map containing user data.
 * @throws {Error} Throws error if saving fails (e.g., QuotaExceededError).
 */
export function saveUserData(usersMap) {
  try {
    // Convert Map to array, ensuring chat history is limited per user during save
    const usersArray = Array.from(usersMap).map(([key, value]) => {
        // Note: Assuming maxChatHistory is managed elsewhere or we use a reasonable default.
        // For now, let's stick to the original logic's location in UserManager,
        // but ideally, this limit should be passed or defined here if storage dictates it.
        // Replicating the slice from original saveUsers for now:
        const maxChatHistory = 50; // Hardcoding based on user-manager.js value
        return [key, {
            ...value,
            mostRecentlySaidThings: value.mostRecentlySaidThings ? value.mostRecentlySaidThings.slice(0, maxChatHistory) : []
        }];
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usersArray));
  } catch (error) {
    console.error('Error saving user data to localStorage:', error);
    // Re-throw the error so the caller (UserManager) can handle it,
    // especially QuotaExceededError.
    throw error;
  }
}

/**
 * Loads user data from localStorage.
 * Parses the stored JSON string back into a Map.
 * @returns {Map<string, object>} The Map containing user data, or an empty Map if not found or error occurs.
 */
export function loadUserData() {
  try {
    const storedUsers = localStorage.getItem(STORAGE_KEY);
    if (storedUsers) {
      const parsedUsersArray = JSON.parse(storedUsers);
      // Convert array back to Map. UserManager will handle merging defaults.
      return new Map(parsedUsersArray);
    }
  } catch (error) {
    console.error('Error loading or parsing user data from localStorage:', error);
    // Fallback to an empty map if loading/parsing fails
  }
  return new Map(); // Return empty map if no data found or error occurred
}

/**
 * Handles storage quota errors, typically by removing the least recently seen users.
 * Note: The exact implementation might evolve based on requirements.
 * @param {Map<string, object>} usersMap - The current Map of users before attempting to save.
 * @returns {Map<string, object>} A potentially smaller Map after removing some users.
 */
export function handleQuotaError(usersMap) {
  console.warn("Storage quota exceeded. Attempting to clear users with lowest token spend...");
  try {
    // Implement cleanup strategy - remove half of the users with the lowest token spend
    const sortedUsers = Array.from(usersMap.entries())
      .sort(([, userA], [, userB]) => {
        const aTotalSpent = userA.tokenStats?.totalSpent ?? 0;
        const bTotalSpent = userB.tokenStats?.totalSpent ?? 0;
        return aTotalSpent - bTotalSpent; // Sorts lowest token spend first
      });

    const usersToKeepCount = Math.ceil(sortedUsers.length / 2); // Keep slightly more than half if odd
    const usersToKeep = sortedUsers.slice(sortedUsers.length - usersToKeepCount);

    console.log(`Quota strategy: Removed ${sortedUsers.length - usersToKeepCount} users.`);
    return new Map(usersToKeep); // Return the reduced Map
  } catch (error) {
      console.error("Error during quota handling cleanup:", error);
      // If cleanup fails, return the original map to avoid further data loss
      return usersMap;
  }
}