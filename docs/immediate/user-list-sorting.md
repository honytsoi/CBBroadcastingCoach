# Enhance User List Sorting

## Goal
Implement a two-level sorting mechanism for the displayed user list:
1. Sort by online status (Online users first, then Offline)
2. Within each status group, sort by total tokens spent (highest spenders at the top)

## Relevant Files
- `static/src/app.js` (UI rendering)
- `static/src/user-manager.js` (`getAllUsers` method)

## Research Needed
- Locate the code in `static/src/app.js` responsible for fetching and rendering the user list
  - Assumption: `app.js` calls `userManager.getAllUsers()` and renders the result
- Determine the best place to implement the new sorting logic
  - Conclusion: Modifying `UserManager.getAllUsers` is cleaner as it keeps data logic encapsulated
- Confirm the correct field for total token spend
  - Conclusion: `user.tokenStats.totalSpent`, confirmed in Item 2

## Plan
1. **Locate Target Function**
   - Modify the existing `UserManager.getAllUsers` method in `static/src/user-manager.js`

2. **Identify Token Field**
   - Use `user.tokenStats.totalSpent`

3. **Modify Sorting Logic**
   - Keep the primary sort condition for online status:
     ```javascript
     if (a.isOnline && !b.isOnline) return -1;
     if (!a.isOnline && b.isOnline) return 1;
     ```
   - Replace the secondary sort condition (currently by `lastSeenDate`) with sorting by `tokenStats.totalSpent` in descending order (highest spenders first)
   - The new secondary sort logic will be:
     ```javascript
     return (b.tokenStats?.totalSpent ?? 0) - (a.tokenStats?.totalSpent ?? 0);
     ```
   - This safely handles potentially missing `tokenStats` or `totalSpent` fields by treating them as 0

4. **Testing**
   - Verify in the UI that the user list sorts online users first
   - Within both online and offline groups, users should be sorted by total token spend (highest first)
