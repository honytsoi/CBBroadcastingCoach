let saveDebounceTimeout = null;

/**
 * Debounces a save function by the specified delay.
 * @param {Function} saveFunction - The function to call after the delay.
 * @param {number} delay - Delay in milliseconds (default: 1000ms).
 */
export function debouncedSave(saveFunction, delay = 1000) {
  if (saveDebounceTimeout) {
    clearTimeout(saveDebounceTimeout);
  }
  saveDebounceTimeout = setTimeout(saveFunction, delay);
}

/**
 * Saves the users map to persistent storage.
 * Uses the storage-manager module's saveUserData function.
 * Displays an error message if saving fails.
 * @param {Map} usersMap - The map containing user data.
 */
export async function saveUsers(usersMap) {
  try {
    const { saveUserData } = await import('./storage-manager.js');
    await saveUserData(usersMap);
  } catch (error) {
    console.error('Error saving users:', error);
    const { displayError } = await import('./displayError.js');
    displayError('Failed to save user data.');
    // Additional quota error handling could be implemented here.
  }
}

/**
 * Loads the users map from persistent storage.
 * Uses the storage-manager module's loadUserData function.
 * Applies default user settings and resets online status.
 * @param {Function} getDefaultUser - Function to get a default user object given a username.
 * @returns {Promise<Map>} - A Promise that resolves to the users map.
 */
export async function loadUsers(getDefaultUser) {
  const usersMap = new Map();
  try {
    const { loadUserData } = await import('./storage-manager.js');
    const data = await loadUserData();
    if (data && typeof data === 'object') {
      // Assuming data is an object with usernames as keys.
      Object.keys(data).forEach(username => {
        let user = data[username];
        // Merge with default user structure.
        user = { ...getDefaultUser(username), ...user };
        // Reset online status.
        user.isOnline = false;
        usersMap.set(username, user);
      });
    }
  } catch (error) {
    console.error('Error loading users:', error);
    const { displayError } = await import('./displayError.js');
    displayError('Failed to load user data. Starting with default settings.');
  }
  return usersMap;
}
