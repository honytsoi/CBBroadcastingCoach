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