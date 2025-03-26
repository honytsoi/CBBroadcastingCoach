# Improve Quota Handling

## Goal
Modify the `localStorage` quota handling logic. When the quota is exceeded, remove users with the lowest total token spend, rather than the least recently seen users.

## Relevant Files
The refactored `handleQuotaError` function in the planned `static/src/storage-manager.js` (from Item 1).

## Research Needed
- Identify the correct field within the user object that represents the total token spend
  - Conclusion: `user.tokenStats.totalSpent` is the most comprehensive field, updated by various events via `addEvent` -> `updateTokenStats`
- Determine how to update the sorting logic in the refactored `handleQuotaError` function

## Plan
1. **Locate Target Function**
   - The logic will reside in the `handleQuotaError` function within the planned `static/src/storage-manager.js` file (created in Item 1)

2. **Identify Token Field**
   - Use `user.tokenStats.totalSpent` as the field representing total token spend

3. **Modify Sorting Logic**
   - Inside `handleQuotaError(usersMap)`, convert the `usersMap` to an array of its entries (`[username, userObject]`)
   - Sort this array in ascending order based on the `tokenStats.totalSpent` value of the `userObject`
   - Handle potential missing `tokenStats` or `totalSpent` by treating them as 0 for sorting purposes (e.g., `(a[1].tokenStats?.totalSpent ?? 0) - (b[1].tokenStats?.totalSpent ?? 0)`)

4. **Implement Removal**
   - Retain the existing logic of removing the first half of the *sorted* array (those with the lowest `tokenStats.totalSpent`)

5. **Return Updated Map**
   - Convert the remaining entries (the top half with higher spending) back into a `Map` and return it

6. **Testing**
   - Unit test the `handleQuotaError` function with mock user data having varying `tokenStats.totalSpent` values to verify that the correct users are removed
