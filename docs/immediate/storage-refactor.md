# Refactor Storage Logic

## Goal
Isolate `localStorage` operations (`saveUsers`, `loadUsers`, `handleStorageError`) from `UserManager` into dedicated helper functions. This will make it easier to swap out `localStorage` for a different storage solution in the future.

## Relevant Files
- `static/src/user-manager.js`
- Potentially `static/src/data-manager.js` or create a new `static/src/storage-manager.js`

## Research Needed
- Analyze the implementation of `saveUsers`, `loadUsers`, and `handleStorageError` within `static/src/user-manager.js`
- Examine `static/src/data-manager.js` to see if any existing functions can be leveraged or if it's a suitable place for the new storage functions
  - Conclusion: `data-manager.js` is focused on import/export/validation, not persistent storage
- Decide on the best location for the refactored functions
  - Conclusion: Create a new dedicated `static/src/storage-manager.js`

## Plan
1. **Create `static/src/storage-manager.js`**
   - This new file will contain functions dedicated to interacting with the storage mechanism (currently `localStorage`)

2. **Implement Storage Functions**
   - Create `saveUserData(usersMap)`: Takes the `users` Map, converts it to the storable format (array of key-value pairs), and saves it to `localStorage` under the key `broadcastCoachUsers`
   - Create `loadUserData()`: Reads the data from `localStorage`, parses it, and returns it as a Map, ready for `UserManager` to use. Handles potential parsing errors
   - Create `handleQuotaError(usersMap)`: Implements the quota exceeded logic (currently removing least recently seen users). It will take the current `users` Map, perform the cleanup, and return the reduced Map. *This function will be modified later for item 2*

3. **Refactor `UserManager` (`static/src/user-manager.js`)**
   - Import `saveUserData`, `loadUserData`, and `handleQuotaError` from `storage-manager.js`
   - Modify `UserManager.saveUsers`: Remove the `try...catch` block and the direct `localStorage.setItem` call. Instead, call `saveUserData(this.users)`. Keep the error handling structure but call `handleQuotaError` within the `catch` block if the error is `QuotaExceededError`. The `handleQuotaError` function will return the reduced map, which should then be assigned back to `this.users` and saved again
   - Modify `UserManager.loadUsers`: Replace the `localStorage.getItem` and `JSON.parse` calls with a call to `loadUserData()`. Assign the returned Map to `this.users`. Keep the error handling for load failures
   - Remove the original `UserManager.handleStorageError` method as its logic is now in `storage-manager.js`

4. **Testing**
   - Ensure the application still saves and loads user data correctly after the refactoring
