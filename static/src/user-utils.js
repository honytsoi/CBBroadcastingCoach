export function getDefaultUser(username) {
  return {
    username: username,
    events: [],
    tokenStats: {
      totalSpent: 0,
      spentInPeriods: {}
    },
    isOnline: false,
    firstSeenDate: new Date(),
    lastSeenDate: new Date()
  };
}