/*
 * user-token-manager.js
 * Handles all logic related to token calculations and statistics.
 */

/**
 * Updates token statistics for a user based on a new event.
 * @param {Object} user - The user object.
 * @param {Object} event - The event object.
 */
export function updateTokenStats(user, event) {
  if (!user.tokenStats) {
    user.tokenStats = {
      totalSpent: 0,
      spentInPeriods: {},
    };
  }
  if (event.type === 'tip') {
    const tip = parseFloat(event.data.tipAmount) || 0;
    user.tokenStats.totalSpent += tip;
    updateTimePeriod(user.tokenStats.spentInPeriods, tip);
  }
}

/**
 * Helper function to update spending for the current day.
 * @param {Object} periodMap - An object mapping dates to spending amounts.
 * @param {number} amount - The amount to add.
 */
export function updateTimePeriod(periodMap, amount) {
  const today = new Date().toISOString().split('T')[0];
  if (!periodMap[today]) {
    periodMap[today] = 0;
  }
  periodMap[today] += amount;
}

/**
 * Recalculates all token totals for a user from scratch based on their event history.
 * @param {Object} user - The user object.
 */
export function recalculateTotals(user) {
  user.tokenStats = {
    totalSpent: 0,
    spentInPeriods: {},
  };
  if (user.events && Array.isArray(user.events)) {
    user.events.forEach(event => {
      updateTokenStats(user, event);
    });
  }
}

/**
 * Retrieves the total tokens spent by the user.
 * @param {Object} user - The user object.
 * @returns {number} Total tokens spent.
 */
export function getTotalSpent(user) {
  return user.tokenStats ? user.tokenStats.totalSpent : 0;
}

/**
 * Gets the total spending in a specified period.
 * @param {Object} user - The user object.
 * @param {number} days - Number of days for the period.
 * @param {string} category - Category of spending (unused in this implementation).
 * @returns {number} Total spending in the period.
 */
export function getSpentInPeriod(user, days, category) {
  return calculateCustomPeriodTotal(user, days, category);
}

/**
 * Calculates the total tokens spent over a custom period.
 * @param {Object} user - The user object.
 * @param {number} days - Number of days to look back.
 * @param {string} category - Category of spending (unused in this implementation).
 * @returns {number} Total tokens spent in the period.
 */
export function calculateCustomPeriodTotal(user, days, category) {
  let total = 0;
  if (!user.tokenStats || !user.tokenStats.spentInPeriods) return 0;
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    total += user.tokenStats.spentInPeriods[dateStr] || 0;
  }
  return total;
}