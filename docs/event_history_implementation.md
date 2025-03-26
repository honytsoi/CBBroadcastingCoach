# Event History Implementation Plan

## Overview
Replace separate chat and token histories with unified event history tracking all user interactions. This will support:
- Full historical context per user
- Standardized event handling  
- Flexible filtering/reporting
- Simplified data model
- Allow token_history.csv (see token_history_example.csv) to be imported through settings panel

Take care to note which parts are the CloudFlare Worker backend and which ones are the local browser JavaScript. Do not try to us npm packages, if modules are needed they have to be loaded into the front end using cdns.

## Data Structure Changes

### New User Object Structure
```js
{
  // Existing fields...
  eventHistory: [
    {
      username: String, 
      type: String, // Event type (see supported types below)
      timestamp: ISOString,
      data: {       // Type-specific payload
        // Common fields (marked with ? are optional)
        note: string | null,    // Optional note
        amount: number | null,  // Optional amount
        
        // Type-specific fields
        content: string | null,    // Message content (for chat/private events)
        isPrivate: boolean | null, // Message visibility flag
        fanClubMember: boolean | null,       // Fanclub yes or no, there are no tiers
        item: string | null,       // Purchased media item name
        subject: string | null     // Room subject text
      }
    }
  ],
  // Aggregated metrics
  tokenStats: {
    username: String, 
    totalSpent: number,
    lastUpdated: ISOString,
    timePeriods: {
      day7: {
        tips: number,
        privates: number,
        media: number
      },
      day30: {
        tips: number,
        privates: number, 
        media: number
      }
    }
  },
  maxHistory: 1000 // Configurable limit
}
```

### Supported Event Types
1. `broadcastStart` - Stream begins
2. `broadcastStop` - Stream ends  
3. `chatMessage` - Public chat message
4. `fanclubJoin` - User joins fanclub
5. `follow` - User follows broadcaster
6. `mediaPurchase` - User buys media
7. `privateMessage` - Private message
8. `roomSubjectChange` - Room topic update
9. `tip` - Token tip received  
10. `unfollow` - User unfollows
11. `userEnter` - User enters room
12. `userLeave` - User leaves room

13. `privateShow` - Combined private show session (meta event)
    - Data structure:
      ```js
      { username: String, 
        duration: number,  // Total seconds
        tokens: number,    // Total tokens spent
        startTime: string, // ISO timestamp
        endTime: string    // ISO timestamp
      }
      ```
14. `privateShowSpy` - Combined spy session (meta event)
    - Data structure:
      ```js
      { username: String, 
        duration: number,  // Total seconds
        tokens: number,    // Total tokens spent  
        startTime: string, // ISO timestamp
        endTime: string    // ISO timestamp
      }
      ```

## API Changes

### New Methods (`UserManager` class)
```js
// Base handler
addEvent(username, type, data)

// Convenience methods  
recordTip(username, amount, note)
addChatMessage(username, content)  
addPrivateMessage(username, content)
recordMediaPurchase(username, item, price)
recordUserEnter(username)
recordUserLeave(username)
recordFollow(username) 
recordUnfollow(username)
recordBroadcastStart()
recordBroadcastStop()
recordFanclubJoin(username) // needs a way to show left or expired, not yet implemented
recordRoomSubjectChange(subject)
```

### Modified Methods
- Replace `mostRecentlySaidThings` with filtered `eventHistory`
- Replace tip tracking with aggregated `eventHistory` totals  
- Update `importData`/`exportData` for new format

## UI Changes  

### Settings Panel
1. Add "Import Token History" button
2. File selection dialog
3. Progress indicators
4. Error reporting

### User Profiles  
1. Consolidated event timeline
2. Filter by event type
3. Search functionality

## Data Migration  

No data migration, old data is prototyping and to be abandonded.
Breaking change is ok.


## Aggregation and Queries

### Maintaining Totals
1. When adding events:
   - Update running totals immediately
   - Store lastUpdated timestamp
   - Recalculate time period aggregates if needed

2. Recalculation Methods:
```js
recalculateTotals(user) {
  // Reset all totals
  user.tokenStats = {
    totalSpent: 0,
    lastUpdated: new Date().toISOString(),
    timePeriods: { day7: {}, day30: {} }
  };

  // Process all relevant events
  user.eventHistory.forEach(event => {
    if (event.data.amount) {
      user.tokenStats.totalSpent += event.data.amount;
      
      // Add to time periods if within range
      const eventDate = new Date(event.timestamp);
      const daysAgo = (Date.now() - eventDate) / (1000*60*60*24);
      
      if (daysAgo <= 7) {
        user.tokenStats.timePeriods.day7[event.type] = 
          (user.tokenStats.timePeriods.day7[event.type] || 0) + event.data.amount;
      }
      if (daysAgo <= 30) {
        user.tokenStats.timePeriods.day30[event.type] = 
          (user.tokenStats.timePeriods.day30[event.type] || 0) + event.data.amount;
      }
    }
  });
}
```

### Query Methods
```js
getTotalSpent(username) {
  return this.getUser(username)?.tokenStats.totalSpent || 0;
}

getSpentInPeriod(username, days, eventType) {
  const user = this.getUser(username);
  if (!user) return 0;
  
  if (days === 7) return user.tokenStats.timePeriods.day7[eventType] || 0;
  if (days === 30) return user.tokenStats.timePeriods.day30[eventType] || 0;
  
  // Fallback to full scan for custom periods
  return this.calculateCustomPeriodTotal(user, days, eventType);
}
```

## CSV Import Process

### Token History Import
1. Parse CSV using PapaParse
2. Create users in history if they don't already exist or add to existing user if already there
3. For each row, check if that timestamp/amount already exists (duplicate), and if not then add
   ```js
   recordTip(row.User, row['Token change'], row.Note, row.Timestamp)
   ```
4. Private Show Handling:
   - Identify sequences of private show entries (occurring every ~10 seconds)
   - When gap >30 seconds detected, create meta event:
     ```js
     {
      username: String, 
       type: 'privateShow',
       timestamp: firstEntryTime,
       data: {
         duration: totalSeconds,
         tokens: sumOfTokens,
         startTime: firstEntryTime,
         endTime: lastEntryTime
       }
     }
     ```
   - Same approach for privateShowSpy entries
   - Remove individual 10-sec entries after creating meta event
4. Update UI with import results ("x tokens added")

### Error Handling
- Invalid file format
- Missing required fields  
- Duplicate entries
- Storage limits

## Testing Plan
1. Unit tests for:
   - Event creation
   - Migration logic
   - CSV parsing
2. Integration tests:
   - Import/export flows
   - UI interactions
3. Performance testing:
   - Large history sets
   - Bulk imports


# Phased Implementation - Current Status

Each phase shall be standalone - the app will work without errors (though may not have all new functionality). Unit tests will be added/modified for each phase.

## [DONE] Phase 1: Core Data Structure Changes
- ✓ Implemented new `eventHistory` array in user object
- ✓ Created base `addEvent()` method
- ✓ Updated `getDefaultUser()` with new structure
- ✓ Added basic event type handlers (tip, chatMessage)
- ✓ Unit tests for new data structure
- ✓ No UI changes yet

## [PARTIAL] Phase 2: Event Type Implementation
- ✓ Basic event types implemented (tip, chatMessage)
- ✓ Added convenience methods for: `mediaPurchase`, `userEnter`, `userLeave`, `follow`, `unfollow`, `broadcastStart`, `broadcastStop`, `fanclubJoin`, `roomSubjectChange`.
- ✓ PrivateShow/privateShowSpy meta event *generation* implemented within CSV import. (Note: No direct convenience methods like `recordPrivateShowStart/Stop` yet).
- ✓ Console logging of events exists
- ✗ Need more comprehensive unit tests for all event types.

## [PARTIAL] Phase 3: Aggregation System
- ✓ Basic tokenStats aggregation implemented (`updateTokenStats` called by `addEvent`).
- ✓ `recalculateTotals()` method exists.
- ✗ Time period breakdowns (7d, 30d) not fully tested within `updateTokenStats` or `recalculateTotals`.
- ✓ Basic query methods available (`getTotalSpent`, `getSpentInPeriod`, `calculateCustomPeriodTotal`).
- ✗ Needs more comprehensive unit tests for aggregation and queries.

## [DONE] Phase 4: CSV Import Functionality
- ✓ CSV parsing implemented (using PapaParse via CDN, with fallback).
- ✓ Duplicate detection implemented (checks timestamp & amount against existing history).
- ✓ Private show/spy meta event generation implemented (replaces individual entries).
- ✓ Basic import error handling added (file type check, processing errors, result display).
- ✓ Unit tests added for import logic (`tests/user-manager.test.js`).

## [PARTIAL] Phase 5: UI Integration
- ✓ Import button added to settings panel.
- ✓ Button wired up to functionality (`handleImportTokenHistory` in `app.js`).
- ✓ File selection dialog implemented.
- ✓ Progress indicator added ("Processing...").
- ✓ Error/Success reporting added (`dataManagementResult`).
- ✓ Event timeline preview added to user profiles (shows latest 5).
- ✗ Full event timeline view (e.g., modal) not implemented.
- ✗ User profile UI doesn't yet use new query methods (`getSpentInPeriod`) for detailed stats.

## [TODO] Phase 6: Performance Optimization
- ✗ Lazy loading not implemented
- ✗ Pagination needed
- ✗ Aggregation optimizations
- ✗ Caching system
- ✗ Performance testing

Each phase will be:
1. Developed in a feature branch
2. Tested locally
3. Code reviewed
4. Merged to main when stable


# Advice to Programmer

As a junior developer implementing this system, follow these guidelines to ensure success:

## Development Approach
1. **Work incrementally** - Complete one small piece at a time and verify it works before moving on
2. **Follow the phases** - Stick to the phased implementation plan, don't jump ahead
3. **Test constantly** - Write tests as you go, not just at the end
4. **Commit often** - Small, frequent commits with clear messages

## Common Pitfalls & Solutions
1. **Data consistency**:
   - Always update both eventHistory and tokenStats together
   - Use the recalculateTotals() method after bulk changes
   - Verify totals match with `JSON.stringify(user.eventHistory).length`

2. **Event handling**:
   - Validate all required fields before adding events
   - Use TypeScript types to catch errors early
   - Test edge cases (empty strings, null values)

3. **Performance**:
   - For large imports, process in chunks (100-200 rows at a time)
   - Use console.time() to identify slow operations
   - Consider web workers for CPU-intensive tasks

## Debugging Tips
1. **Logging**:
   ```js
   console.log('Adding event:', {username, type, data});
   ```
2. **Validation**:
   ```js
   function validateEvent(event) {
     if (!event.type) throw new Error('Missing event type');
     // Add other validations
   }
   ```
3. **Test Data**:
   - Create a small test CSV (5-10 rows) for development
   - Include edge cases (empty notes, negative amounts)

## Testing Strategy
1. **Unit Tests**:
   - Test each event type separately
   - Verify aggregation calculations
   - Test import error handling

2. **Integration Tests**:
   - Test complete import workflows
   - Verify UI updates after imports
   - Test with malformed CSV files

3. **Manual Verification**:
   ```js
   // After import, verify totals
   const user = userManager.getUser('testuser');
   console.log('Total spent:', user.tokenStats.totalSpent);
   ```

## When You Get Stuck
1. **Check the data** - console.log your objects at each step
2. **Simplify** - Reduce to a minimal test case
3. **Ask for help** - Share:
   - What you tried
   - What you expected
   - What actually happened
   - Relevant code snippets

Remember: It's better to move slowly and get it right than to rush and create bugs!
