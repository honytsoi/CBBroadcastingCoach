# Action Plan for Immediate TODO Items (2025-03-26)

This document outlines the plan for addressing the "Immediate" priority items listed in `TODO.md`. It includes the goal for each item and the necessary research steps before implementation.

## 1. Refactor Storage Logic

*   **Goal:** Isolate `localStorage` operations (`saveUsers`, `loadUsers`, `handleStorageError`) from `UserManager` into dedicated helper functions. This will make it easier to swap out `localStorage` for a different storage solution in the future.
*   **Relevant Files:** `static/src/user-manager.js`, potentially `static/src/data-manager.js` or create a new `static/src/storage-manager.js`.
*   **Research Needed:**
    *   Analyze the implementation of `saveUsers`, `loadUsers`, and `handleStorageError` within `static/src/user-manager.js`.
    *   Examine `static/src/data-manager.js` to see if any existing functions can be leveraged or if it's a suitable place for the new storage functions. (Conclusion: `data-manager.js` is focused on import/export/validation, not persistent storage.)
    *   Decide on the best location for the refactored functions. (Conclusion: Create a new dedicated `static/src/storage-manager.js`.)
*   **Plan:**
    1.  **Create `static/src/storage-manager.js`**: This new file will contain functions dedicated to interacting with the storage mechanism (currently `localStorage`).
    2.  **Implement Storage Functions**:
        *   Create `saveUserData(usersMap)`: Takes the `users` Map, converts it to the storable format (array of key-value pairs), and saves it to `localStorage` under the key `broadcastCoachUsers`.
        *   Create `loadUserData()`: Reads the data from `localStorage`, parses it, and returns it as a Map, ready for `UserManager` to use. Handles potential parsing errors.
        *   Create `handleQuotaError(usersMap)`: Implements the quota exceeded logic (currently removing least recently seen users). It will take the current `users` Map, perform the cleanup, and return the reduced Map. *This function will be modified later for item 2.*
    3.  **Refactor `UserManager` (`static/src/user-manager.js`)**:
        *   Import `saveUserData`, `loadUserData`, and `handleQuotaError` from `storage-manager.js`.
        *   Modify `UserManager.saveUsers`: Remove the `try...catch` block and the direct `localStorage.setItem` call. Instead, call `saveUserData(this.users)`. Keep the error handling structure but call `handleQuotaError` within the `catch` block if the error is `QuotaExceededError`. The `handleQuotaError` function will return the reduced map, which should then be assigned back to `this.users` and saved again.
        *   Modify `UserManager.loadUsers`: Replace the `localStorage.getItem` and `JSON.parse` calls with a call to `loadUserData()`. Assign the returned Map to `this.users`. Keep the error handling for load failures.
        *   Remove the original `UserManager.handleStorageError` method as its logic is now in `storage-manager.js`.
    4.  **Testing**: Ensure the application still saves and loads user data correctly after the refactoring.

## 2. Improve Quota Handling

*   **Goal:** Modify the `localStorage` quota handling logic. When the quota is exceeded, remove users with the lowest total token spend, rather than the least recently seen users.
*   **Relevant Files:** The refactored `handleQuotaError` function in the planned `static/src/storage-manager.js` (from Item 1).
*   **Research Needed:**
    *   Identify the correct field within the user object that represents the total token spend. (Conclusion: `user.tokenStats.totalSpent` is the most comprehensive field, updated by various events via `addEvent` -> `updateTokenStats`).
    *   Determine how to update the sorting logic in the refactored `handleQuotaError` function.
*   **Plan:**
    1.  **Locate Target Function**: The logic will reside in the `handleQuotaError` function within the planned `static/src/storage-manager.js` file (created in Item 1).
    2.  **Identify Token Field**: Use `user.tokenStats.totalSpent` as the field representing total token spend.
    3.  **Modify Sorting Logic**:
        *   Inside `handleQuotaError(usersMap)`, convert the `usersMap` to an array of its entries (`[username, userObject]`).
        *   Sort this array in ascending order based on the `tokenStats.totalSpent` value of the `userObject`. Handle potential missing `tokenStats` or `totalSpent` by treating them as 0 for sorting purposes (e.g., `(a[1].tokenStats?.totalSpent ?? 0) - (b[1].tokenStats?.totalSpent ?? 0)`).
    4.  **Implement Removal**: Retain the existing logic of removing the first half of the *sorted* array (those with the lowest `tokenStats.totalSpent`).
    5.  **Return Updated Map**: Convert the remaining entries (the top half with higher spending) back into a `Map` and return it.
    6.  **Testing**: Unit test the `handleQuotaError` function with mock user data having varying `tokenStats.totalSpent` values to verify that the correct users are removed.

## 3. Enhance User List Sorting

*   **Goal:** Implement a two-level sorting mechanism for the displayed user list:
    1.  Sort by online status (Online users first, then Offline).
    2.  Within each status group, sort by total tokens spent (highest spenders at the top).
*   **Relevant Files:** `static/src/app.js` (UI rendering), `static/src/user-manager.js` (`getAllUsers` method).
*   **Research Needed:**
    *   Locate the code in `static/src/app.js` responsible for fetching and rendering the user list. (Assumption: `app.js` calls `userManager.getAllUsers()` and renders the result).
    *   Determine the best place to implement the new sorting logic. (Conclusion: Modifying `UserManager.getAllUsers` is cleaner as it keeps data logic encapsulated).
    *   Confirm the correct field for total token spend. (Conclusion: `user.tokenStats.totalSpent`, confirmed in Item 2).
*   **Plan:**
    1.  **Locate Target Function**: Modify the existing `UserManager.getAllUsers` method in `static/src/user-manager.js`.
    2.  **Identify Token Field**: Use `user.tokenStats.totalSpent`.
    3.  **Modify Sorting Logic**:
        *   Keep the primary sort condition for online status: `if (a.isOnline && !b.isOnline) return -1; if (!a.isOnline && b.isOnline) return 1;`.
        *   Replace the secondary sort condition (currently by `lastSeenDate`) with sorting by `tokenStats.totalSpent` in descending order (highest spenders first).
        *   The new secondary sort logic will be: `return (b.tokenStats?.totalSpent ?? 0) - (a.tokenStats?.totalSpent ?? 0);`. This safely handles potentially missing `tokenStats` or `totalSpent` fields by treating them as 0.
    4.  **Testing**: Verify in the UI that the user list sorts online users first, and within both online and offline groups, users are sorted by total token spend (highest first).

## 4. Refine Event History Timestamps

*   **Goal:** Adjust the display format for event timestamps in the user history view. Show the full date and time (e.g., "YYYY-MM-DD HH:MM:SS") only if the event did *not* occur on the current day. For events that occurred today, show only the time (e.g., "HH:MM:SS").
*   **Relevant Files:** `static/src/app.js` (specifically the `updateUsersUI` function).
*   **Research Needed:**
    *   Locate the code in `static/src/app.js` that renders the event history for a selected user. (Conclusion: Found within the `updateUsersUI` function, specifically the line setting `eventTime.textContent`).
    *   Determine the best way to implement the date comparison and conditional formatting.
*   **Plan:**
    1.  **Locate Target Code**: Identify the timestamp formatting line within the `updateUsersUI` function in `static/src/app.js` (currently `eventTime.textContent = new Date(event.timestamp).toLocaleTimeString();`).
    2.  **Create Helper Function**: Implement a new helper function, e.g., `formatEventTimestamp(isoTimestampString)`, within `static/src/app.js`.
    3.  **Implement Formatting Logic in Helper**:
        *   Inside `formatEventTimestamp`, parse the input `isoTimestampString` into a `Date` object (`eventDate`).
        *   Get the current date (`const now = new Date();`).
        *   Compare the year, month, and day of `eventDate` with `now`.
        *   If the event occurred today: Return `eventDate.toLocaleTimeString()`.
        *   If the event occurred on a previous day: Construct and return a string in "YYYY-MM-DD HH:MM:SS" format. Helper functions for zero-padding single-digit month/day/hour/minute/second values might be useful (e.g., `String(num).padStart(2, '0')`).
    4.  **Update Rendering Code**: Modify the line identified in step 1 to call the new helper function: `eventTime.textContent = formatEventTimestamp(event.timestamp);`.
    5.  **Testing**: Verify in the UI that event timestamps within the user details section are formatted correctly based on whether they occurred today or on a previous day. Check edge cases like midnight transitions.

## 5. Clarify Event History Labels

*   **Goal:** Improve the clarity of the event history display by using specific labels for different types of token-spending events, instead of labeling everything as a "Tip". Examples: "Media Purchase", "Private Show Start", "Spy Show".
*   **Relevant Files:** `static/src/app.js` (`updateUsersUI` function), `static/src/user-manager.js` (event type definitions).
*   **Research Needed:**
    *   Locate the code in `static/src/app.js` that renders individual events in the history view. (Conclusion: Found in the `switch(event.type)` block within `updateUsersUI`).
    *   Consult `static/src/user-manager.js` to identify all relevant event `type` values associated with token spending. (Conclusion: Key types are `tip`, `mediaPurchase`, `privateShow`, `privateShowSpy`).
    *   Define clearer, user-friendly display labels for these types.
*   **Plan:**
    1.  **Locate Target Code**: Identify the `switch(event.type)` block within the `updateUsersUI` function in `static/src/app.js`.
    2.  **Define Label Mapping (Conceptual)**:
        *   `tip`: "Tip: {amount} tokens" (Add note if present: "Tip: {amount} tokens - {note}")
        *   `mediaPurchase`: "Media Purchase: {item} ({amount} tokens)"
        *   `privateShow`: "Private Show ({duration}s, {tokens} tokens)"
        *   `privateShowSpy`: "Spy Show ({duration}s, {tokens} tokens)"
        *   `chatMessage`: "Said: {content}" (Keep as is)
        *   `privateMessage`: "Private: {content}" (Keep as is)
        *   Other types (`userEnter`, `userLeave`, etc.): Use the `event.type` string directly or create simple labels like "Entered Room", "Left Room".
    3.  **Update Rendering Logic**: Modify the `case` statements within the `switch` block:
        *   For `tip`: Update the `eventContent.textContent` to include the note if `event.data.note` exists. Use `event.data.amount`.
        *   For `mediaPurchase`: Update `eventContent.textContent` to include `event.data.amount`. Use `event.data.item`.
        *   For `privateShow` and `privateShowSpy`: Change "t)" to " tokens)". Use `event.data.tokens` and `event.data.duration`.
        *   Ensure all relevant data fields (`amount`, `note`, `item`, `duration`, `tokens`, `content`) are accessed correctly from `event.data`.
        *   Add cases or refine the `default` case for other event types if desired for better clarity (e.g., 'Entered Room' instead of 'userEnter').
    4.  **Testing**: Verify in the UI that event history items display the updated, clearer labels with consistent token information for spending events. Check events with and without notes, and different spending types.

## 6. Implement "Load More" for Events

*   **Goal:** Replace the current "View all nnn events" link in the event history view with a "Load More" button. Clicking this button should incrementally display more events from the user's history, rather than showing all at once.
*   **Relevant Files:** `static/src/app.js` (`updateUsersUI` function).
*   **Research Needed:**
    *   Locate the code in `static/src/app.js` responsible for displaying the event history and the "View all" link. (Conclusion: Found within `updateUsersUI`, including the button creation and call to the placeholder `showFullEventTimeline`).
    *   Design the pagination logic and state management.
*   **Plan:**
    1.  **Define Constants**: Add constants near the top of `static/src/app.js`:
        ```javascript
        const INITIAL_EVENTS_TO_SHOW = 5;
        const EVENTS_PER_LOAD = 20;
        ```
    2.  **Refactor Event Rendering**:
        *   Create a new helper function `createEventElement(event)` that takes an event object and returns the corresponding DOM element (`eventItem`). This will encapsulate the `switch` statement logic for formatting different event types (leveraging the planned changes from Item 5).
        *   Create another helper function `renderEventBatch(user, timelineElement, startIndex, count)`:
            *   It gets events using `user.eventHistory.slice(startIndex, startIndex + count)`.
            *   It iterates through these events, calls `createEventElement(event)` for each, and appends the result to `timelineElement`.
            *   It returns the number of events actually rendered.
    3.  **Modify `updateUsersUI`**:
        *   Inside the `users.forEach` loop, when creating the `timeline` div, add a data attribute to track shown events: `timeline.dataset.shownEvents = '0';`.
        *   Replace the existing `user.eventHistory.slice(0, 5).forEach(...)` block with a call to `const initialRendered = renderEventBatch(user, timeline, 0, INITIAL_EVENTS_TO_SHOW);`. Update `timeline.dataset.shownEvents = initialRendered;`.
        *   Remove the old "View all" button creation logic.
        *   After rendering the initial batch, call a new function `addLoadMoreButtonIfNeeded(user, timeline)`.
    4.  **Create `addLoadMoreButtonIfNeeded(user, timelineElement)`**:
        *   Get the current count: `const shownCount = parseInt(timelineElement.dataset.shownEvents || '0');`.
        *   Get the total count: `const totalCount = user.eventHistory.length;`.
        *   If `shownCount < totalCount`:
            *   Create a "Load More" button (`loadMoreBtn`).
            *   Set its text: `loadMoreBtn.textContent = \`Load More (\${totalCount - shownCount} remaining)\`;`.
            *   Add a class: `loadMoreBtn.className = 'load-more-events';`.
            *   Add a click event listener to `loadMoreBtn`:
                *   Inside the listener:
                    *   Get the current `shownCount` again from `timelineElement.dataset.shownEvents`.
                    *   Call `const renderedCount = renderEventBatch(user, timelineElement, shownCount, EVENTS_PER_LOAD);`.
                    *   Update the count: `timelineElement.dataset.shownEvents = shownCount + renderedCount;`.
                    *   Remove the clicked button: `loadMoreBtn.remove();`.
                    *   Recursively call `addLoadMoreButtonIfNeeded(user, timelineElement)` to add a new button if more events still remain.
            *   Append `loadMoreBtn` to `timelineElement`.
    5.  **Remove Placeholder**: Delete the old `showFullEventTimeline` function.
    6.  **Testing**: Verify that the initial 5 events load, the "Load More" button appears correctly, clicking it loads the next batch (up to 20), the button text updates, and the button disappears when all events are displayed.

## 7. Fix Post-Import Token Stats Calculation

*   **Goal:** Investigate and correct the issue where the total token spend (`tokenStats.totalSpent` or an equivalent field) shows as zero for some users after importing token history, even though token-spending events were imported.
*   **Relevant Files:** `static/src/user-manager.js` (specifically `importTokenHistory`, `addEvent`, `updateTokenStats`, `recalculateTotals`).
*   **Research Needed:**
    *   Debug the `importTokenHistory` function step-by-step, focusing on how individual events (especially tips and meta-events like private shows) are created and passed to `addEvent`.
    *   Analyze how `addEvent` calls `updateTokenStats`. Verify that `updateTokenStats` correctly identifies token-spending events and updates the `totalSpent` field and relevant time period fields.
    *   Check if `recalculateTotals` is called after import, and if its logic correctly aggregates all token amounts from the `eventHistory`. (Conclusion: `recalculateTotals` exists but is *not* called automatically after `importTokenHistory`. It correctly iterates through history and calls `updateTokenStats` if `event.data.amount` exists).
    *   Analyze the duplicate check logic within `importTokenHistory`. (Conclusion: It explicitly skips rows if an event with the same user, timestamp, and amount already exists in `eventHistory`. This is the most likely cause of zero totals if importing overlapping data).
    *   Ensure consistency between the fields used for sorting (item 3), quota handling (item 2), and the final displayed/calculated total. (Conclusion: All seem to converge on `tokenStats.totalSpent`).
*   **Plan:**
    1.  **Primary Cause:** The issue likely stems from the duplicate check in `importTokenHistory` skipping events already present, thus preventing `updateTokenStats` from being called for those events during the import.
    2.  **Solution:** Implement a recalculation step *after* the import process completes for all users touched by the import.
    3.  **Modify `importTokenHistory` (`static/src/user-manager.js`)**:
        *   The function already tracks unique users involved in the import using the `importedUsers` Set.
        *   Locate the end of the function, just before the `return { success: true, ... }` statement.
        *   Add a new loop:
            ```javascript
            // Recalculate totals for all users affected by the import
            console.log(`Recalculating totals for ${importedUsers.size} users affected by import...`);
            for (const username of importedUsers) {
                const user = this.getUser(username);
                if (user) {
                    this.recalculateTotals(user);
                }
            }
            console.log('Finished recalculating totals.');
            ```
    4.  **Ensure `recalculateTotals` Robustness**: The current implementation seems correct based on how `importTokenHistory` structures event data (using `event.data.amount`). No changes needed for now.
    5.  **Testing**:
        *   Import a CSV file. Verify `totalSpent` is calculated correctly for involved users.
        *   Import the *same* CSV file again. Verify `totalSpent` remains correct (doesn't double).
        *   Import a *different* CSV file with some overlapping and some new events. Verify `totalSpent` reflects the sum of all unique token events across both imports for affected users.
