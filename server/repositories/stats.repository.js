const db = require('../db');

class StatsRepository {
  async getPreviousStats(username, date) {
    const [rows] = await db.execute('SELECT * FROM stats WHERE username = ? AND created_at < ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1', [username, date]);
    return rows.length > 0 ? rows[0] : null;
  }

  async getPreviousStardust(username, date) {
    const [rows] = await db.execute('SELECT stardust, created_at FROM stats WHERE username = ? AND created_at < ? AND stardust IS NOT NULL AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1', [username, date]);
    return rows.length > 0 ? rows[0] : null;
  }

  async getPreviousStatsByGoogleId(googleId, date) {
    const [userRows] = await db.execute('SELECT username FROM users WHERE google_id = ? AND is_deleted = 0', [googleId]);
    if (userRows.length === 0) return null;
    const usernames = userRows.map(u => u.username);
    const placeholders = usernames.map(() => '?').join(',');
    const [rows] = await db.execute(`SELECT * FROM stats WHERE username IN (${placeholders}) AND created_at < ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1`, [...usernames, date]);
    return rows.length > 0 ? rows[0] : null;
  }

  async getPreviousStardustByGoogleId(googleId, date) {
    const [userRows] = await db.execute('SELECT username FROM users WHERE google_id = ? AND is_deleted = 0', [googleId]);
    if (userRows.length === 0) return null;
    const usernames = userRows.map(u => u.username);
    const placeholders = usernames.map(() => '?').join(',');
    const [rows] = await db.execute(`SELECT stardust, created_at FROM stats WHERE username IN (${placeholders}) AND created_at < ? AND stardust IS NOT NULL AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1`, [...usernames, date]);
    return rows.length > 0 ? rows[0] : null;
  }

  async hasStats(username) {
    const [allStats] = await db.execute('SELECT id FROM stats WHERE username = ? AND is_deleted = 0 LIMIT 1', [username]);
    return allStats.length > 0;
  }

  async insertStat(username, level, distanceWalked, caught, stopVisited, totalXp, entryName, insertDate, uploadedAt = null, stardust = null) {
    const finalUploadedAt = uploadedAt || new Date();
    const [result] = await db.execute(
      'INSERT INTO stats (username, level, distance_walked, caught, stop_visited, total_xp, stardust, entry_name, created_at, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, level, distanceWalked, caught, stopVisited, totalXp, stardust, entryName, insertDate, finalUploadedAt]
    );
    return result.insertId;
  }

  async getStatById(id) {
    const [rows] = await db.execute('SELECT * FROM stats WHERE id = ? AND is_deleted = 0', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async updateStat(id, username, level, distanceWalked, caught, stopVisited, totalXp, entryName, createdAt = null, stardust = null) {
    if (createdAt) {
      await db.execute(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, stardust = ?, entry_name = ?, created_at = ? WHERE id = ?',
        [username, level, distanceWalked, caught, stopVisited, totalXp, stardust, entryName, createdAt, id]
      );
    } else {
      await db.execute(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, stardust = ?, entry_name = ? WHERE id = ?',
        [username, level, distanceWalked, caught, stopVisited, totalXp, stardust, entryName, id]
      );
    }
  }

  async softDeleteStat(id) {
    await db.execute('UPDATE stats SET is_deleted = 1 WHERE id = ?', [id]);
  }

  async getStatsByGoogleId(googleId) {
    const [userRows] = await db.execute('SELECT username, google_id, default_unit FROM users WHERE google_id = ? AND is_deleted = 0', [googleId]);
    if (userRows.length === 0) return [];

    const usernames = userRows.map(u => u.username);
    const placeholders = usernames.map(() => '?').join(',');

    const [rows] = await db.execute(`SELECT stats.* FROM stats WHERE username IN (${placeholders}) AND is_deleted = 0 ORDER BY created_at DESC`, usernames);

    const userMap = {};
    for (const u of userRows) {
      userMap[u.username] = { google_id: u.google_id, default_unit: u.default_unit };
    }
    for (const row of rows) {
      row.google_id = userMap[row.username].google_id;
      row.default_unit = userMap[row.username].default_unit;
    }
    return rows;
  }

  async getPaginatedStatsByGoogleId(googleId, limit, offset, sortField = 'created_at', sortDir = 'desc') {
    const allowedSortFields = ['created_at', 'uploaded_at'];
    const actualSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const actualSortDir = (sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedOffset = parseInt(offset, 10) || 0;

    const [userRows] = await db.execute('SELECT username, google_id, default_unit FROM users WHERE google_id = ? AND is_deleted = 0', [googleId]);
    if (userRows.length === 0) return [];

    const usernames = userRows.map(u => u.username);
    const placeholders = usernames.map(() => '?').join(',');

    const [rows] = await db.execute(`SELECT stats.* FROM stats WHERE username IN (${placeholders}) AND is_deleted = 0 ORDER BY ${actualSortField} ${actualSortDir} LIMIT ${parsedLimit} OFFSET ${parsedOffset}`, usernames);

    const userMap = {};
    for (const u of userRows) {
      userMap[u.username] = { google_id: u.google_id, default_unit: u.default_unit };
    }
    for (const row of rows) {
      row.google_id = userMap[row.username].google_id;
      row.default_unit = userMap[row.username].default_unit;
    }
    return rows;
  }

  async getStatsByUsername(username) {
    const [rows] = await db.execute('SELECT id, username, level, distance_walked, caught, stop_visited, total_xp, stardust, entry_name, created_at, uploaded_at FROM stats WHERE username = ? AND is_deleted = 0 ORDER BY created_at ASC', [username]);
    return rows;
  }

  async getPaginatedStatsByUsername(username, limit, offset, sortField = 'created_at', sortDir = 'desc') {
    const allowedSortFields = ['created_at', 'uploaded_at'];
    const actualSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const actualSortDir = (sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedOffset = parseInt(offset, 10) || 0;

    const [rows] = await db.execute(`SELECT id, username, level, distance_walked, caught, stop_visited, total_xp, stardust, entry_name, created_at, uploaded_at FROM stats WHERE username = ? AND is_deleted = 0 ORDER BY ${actualSortField} ${actualSortDir} LIMIT ${parsedLimit} OFFSET ${parsedOffset}`, [username]);
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
