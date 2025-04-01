/*
 * user-data-importer-exporter.js
 * Handles import/export functionalities for user data.
 */

export function exportData(usersMap, configData, password) {
  const usersObject = {};
  usersMap.forEach((value, key) => {
    usersObject[key] = value;
  });
  const data = { users: usersObject, config: configData };
  let json = JSON.stringify(data, null, 2);
  if (password) {
    json = ProtectionEncode(json, password);
  }
  return json;
}

export function importData(jsonData, configState, merge, password, usersMap, saveCallback) {
  let parsed;
  try {
    let dataStr = jsonData;
    if (password) {
      dataStr = ProtectionDeEncode(jsonData, password);
    }
    parsed = JSON.parse(dataStr);
  } catch (e) {
    console.error("Error parsing imported data:", e);
    return;
  }
  if (!merge) {
    usersMap.clear();
  }
  if (parsed.users && typeof parsed.users === 'object') {
    Object.keys(parsed.users).forEach(username => {
      usersMap.set(username, parsed.users[username]);
    });
  }
  if (parsed.config) {
    Object.assign(configState, parsed.config);
  }
  if (saveCallback && typeof saveCallback === "function") {
    saveCallback();
  }
}

export function importTokenHistory(csvData, usersMap, saveCallback) {
  const rows = simpleCSVParse(csvData);
  // Assume first row is header
  rows.slice(1).forEach(row => {
    if (row.length >= 3) {
      const username = row[0].trim();
      const type = row[1].trim();
      const data = { value: row[2].trim() };
      if (!usersMap.has(username)) {
        usersMap.set(username, { username, events: [] });
      }
      const user = usersMap.get(username);
      user.events.push({
        type,
        data,
        timestamp: new Date()
      });
    }
  });
  if (saveCallback && typeof saveCallback === "function") {
    saveCallback();
  }
}

export function restoreFromBackup(configState, usersMap, saveCallback) {
  if (configState.backupData) {
    importData(configState.backupData, configState, false, null, usersMap, saveCallback);
  }
}

export function addUserObject(usersMap, userObject, getDefaultUser) {
  const username = userObject.username;
  if (!usersMap.has(username)) {
    usersMap.set(username, { ...getDefaultUser(username), ...userObject });
  } else {
    const existing = usersMap.get(username);
    usersMap.set(username, { ...existing, ...userObject });
  }
}

export function clearAllUsers(usersMap) {
  usersMap.clear();
}

export function simpleCSVParse(csvData) {
  return csvData.split('\n').map(row => row.split(','));
}

export function ProtectionEncode(text, password) {
  // Simple encoding: reverse text and append password, then base64 encode.
  const combined = text.split('').reverse().join('') + password;
  return btoa(combined);
}

export function ProtectionDeEncode(encodedText, password) {
  const decoded = atob(encodedText);
  if (decoded.endsWith(password)) {
    const reversed = decoded.slice(0, decoded.length - password.length);
    return reversed.split('').reverse().join('');
  }
  throw new Error("Invalid password for decryption.");
}