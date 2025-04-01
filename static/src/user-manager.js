import { addUserMessage, recordUserTip } from './user-event-handler.js';
import { updateTokenStats, recalculateTotals, getTotalSpent } from './user-token-manager.js';
import { saveUsers, loadUsers, debouncedSave } from './user-data-persistence.js';
import { exportData, importData } from './user-data-importer-exporter.js';
import { getDefaultUser } from './user-utils.js';

class UserManager {
  constructor() {
    this.users = new Map();
    // Initialize users by loading from persistence
    loadUsers(getDefaultUser).then(usersMap => {
      this.users = usersMap;
    });
  }

  getUser(username) {
    return this.users.get(username);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  // Delegation for adding a user message
  addUserMessage(username, message) {
    addUserMessage(this.users, username, message);
    debouncedSave(() => saveUsers(this.users));
  }

  // Delegation for recording a tip event
  recordUserTip(username, tipAmount) {
    recordUserTip(this.users, username, tipAmount);
    debouncedSave(() => saveUsers(this.users));
  }

  // Export user data
  exportUserData(configData, password) {
    return exportData(this.users, configData, password);
  }

  // Import user data
  importUserData(jsonData, configState, merge, password) {
    importData(jsonData, configState, merge, password, this.users, () => saveUsers(this.users));
  }
}

export default UserManager;
