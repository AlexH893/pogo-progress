const db = require('../db');

class UserRepository {
  async findByUsername(username) {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ? AND is_deleted = 0', [username]);
    return rows;
  }

  async findByGoogleId(googleId) {
    const [rows] = await db.execute('SELECT username FROM users WHERE google_id = ? AND is_deleted = 0', [googleId]);
    return rows;
  }

  async createUser(username, googleId) {
    if (googleId) {
      await db.execute('INSERT INTO users (username, date_added, date_updated, google_id) VALUES (?, NOW(), NOW(), ?)', 
        [username, googleId]);
    } else {
      await db.execute('INSERT INTO users (username, date_added, date_updated) VALUES (?, NOW(), NOW())', [username]);
    }
  }

  async updateUserGoogleId(username, googleId) {
    await db.execute('UPDATE users SET date_updated = NOW(), google_id = ? WHERE username = ?', 
            [googleId, username]);
  }
  
  async updateDateUpdated(username) {
    await db.execute('UPDATE users SET date_updated = NOW() WHERE username = ?', [username]);
  }

  async updateTutorialDisplay(username, displayTutorial) {
    await db.execute('UPDATE users SET display_tutorial = ? WHERE username = ?', [displayTutorial, username]);
  }

  async getPreferences(googleId) {
    const [rows] = await db.execute('SELECT username, default_unit, show_fun_facts, display_tutorial FROM users WHERE google_id = ? AND is_deleted = 0', [googleId]);
    return rows;
  }

  async updatePreferences(username, defaultUnit, showFunFacts, displayTutorial) {
    await db.execute(
        'UPDATE users SET default_unit = ?, show_fun_facts = COALESCE(?, show_fun_facts), display_tutorial = COALESCE(?, display_tutorial) WHERE username = ?',
        [defaultUnit, showFunFacts, displayTutorial, username]
      );
  }

  async unlinkTrainer(username) {
    await db.execute('UPDATE users SET google_id = NULL WHERE username = ?', [username]);
  }

  async softDeleteUserByGoogleId(googleId) {
    await db.execute(`UPDATE users SET is_deleted = 1 WHERE google_id = ?`, [googleId]);
  }
  
  // For Cypress test cleanup
  async deleteByUsernames(usernames) {
    if (usernames.length === 0) return;
    const placeholders = usernames.map(() => '?').join(',');
    await db.execute(`DELETE FROM users WHERE username IN (${placeholders})`, usernames);
  }
  
  async findByGoogleIdIncludingDeleted(googleId) {
     const [rows] = await db.execute('SELECT username FROM users WHERE google_id = ?', [googleId]);
     return rows;
  }
}

module.exports = new UserRepository();
