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