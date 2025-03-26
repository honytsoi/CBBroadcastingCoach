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
