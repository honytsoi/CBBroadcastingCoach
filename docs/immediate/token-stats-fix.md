
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
