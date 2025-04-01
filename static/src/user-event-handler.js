export function addEvent(usersMap, username, type, data, config = {}) {
  if (!usersMap.has(username)) {
    usersMap.set(username, { username, events: [], firstSeenDate: new Date(), lastSeenDate: new Date() });
  }
  const user = usersMap.get(username);
  user.events.push({ type, data, timestamp: new Date() });
  if (!user.firstSeenDate) {
    user.firstSeenDate = new Date();
  }
  user.lastSeenDate = new Date();
  const maxChatHistory = config.maxChatHistory || 100;
  if (user.events.length > maxChatHistory) {
    user.events.shift();
  }
}

export function addUserMessage(usersMap, username, message) {
  addEvent(usersMap, username, 'message', { message });
}

export function recordUserTip(usersMap, username, tipAmount) {
  addEvent(usersMap, username, 'tip', { tipAmount });
}