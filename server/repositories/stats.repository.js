const db = require('../db');

class StatsRepository {
  async getPreviousStats(username, date) {
    const [rows] = await db.execute('SELECT * FROM stats WHERE username = ? AND created_at <= ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1', [username, date]);
    return rows.length > 0 ? rows[0] : null;
  }

  async hasStats(username) {
    const [allStats] = await db.execute('SELECT id FROM stats WHERE username = ? AND is_deleted = 0 LIMIT 1', [username]);
    return allStats.length > 0;
  }

  async insertStat(username, level, distanceWalked, caught, stopVisited, totalXp, entryName, insertDate) {
    const [result] = await db.execute(
      'INSERT INTO stats (username, level, distance_walked, caught, stop_visited, total_xp, entry_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, level, distanceWalked, caught, stopVisited, totalXp, entryName, insertDate]
    );
    return result.insertId;
  }

  async getStatById(id) {
    const [rows] = await db.execute('SELECT * FROM stats WHERE id = ? AND is_deleted = 0', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async updateStat(id, username, level, distanceWalked, caught, stopVisited, totalXp, entryName, createdAt = null) {
    if (createdAt) {
      await db.execute(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, entry_name = ?, created_at = ? WHERE id = ?',
        [username, level, distanceWalked, caught, stopVisited, totalXp, entryName, createdAt, id]
      );
    } else {
      await db.execute(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, entry_name = ? WHERE id = ?',
        [username, level, distanceWalked, caught, stopVisited, totalXp, entryName, id]
      );
    }
  }

  async softDeleteStat(id) {
    await db.execute('UPDATE stats SET is_deleted = 1 WHERE id = ?', [id]);
  }

  async getStatsByGoogleId(googleId) {
    const [rows] = await db.execute('SELECT stats.*, users.google_id, users.default_unit FROM stats LEFT JOIN users ON stats.username = users.username WHERE users.google_id = ? AND stats.is_deleted = 0 AND users.is_deleted = 0 ORDER BY stats.created_at DESC', [googleId]);
    return rows;
  }

  async getStatsByUsername(username) {
    const [rows] = await db.execute('SELECT id, username, level, distance_walked, caught, stop_visited, total_xp, entry_name, created_at FROM stats WHERE username = ? AND is_deleted = 0 ORDER BY created_at ASC', [username]);
    return rows;
  }

  async getStatsByUsernames(usernames) {
    if (usernames.length === 0) return [];
    const placeholders = usernames.map(() => '?').join(',');
    const [rows] = await db.execute(`SELECT * FROM stats WHERE username IN (${placeholders}) AND is_deleted = 0 ORDER BY username ASC, created_at ASC`, usernames);
    return rows;
  }

  async softDeleteStatsByUsernames(usernames) {
    if (usernames.length === 0) return;
    const placeholders = usernames.map(() => '?').join(',');
    await db.execute(`UPDATE stats SET is_deleted = 1 WHERE username IN (${placeholders})`, usernames);
  }

  async hardDeleteStatsByUsernames(usernames) {
    if (usernames.length === 0) return;
    const placeholders = usernames.map(() => '?').join(',');
    await db.execute(`DELETE FROM stats WHERE username IN (${placeholders})`, usernames);
  }
}

module.exports = new StatsRepository();
