module.exports = function (app, db) {

  // Posts user's stats to database. Used when the user first uploads a screenshot.
  app.post('/post-data', async (req, res) => {
    try {
      const { username, level, distanceWalked, caught, stopVisited, totalXp, entryName } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Username required' });
      }

      // Fetch the previous stats before inserting
      const [prevRows] = await db.execute('SELECT * FROM stats WHERE username = ? ORDER BY created_at DESC LIMIT 1', [username]);
      const previousStats = prevRows.length > 0 ? prevRows[0] : null;
      
      // 1. Handle Users Table
      const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (rows.length > 0) {
        await db.execute('UPDATE users SET date_updated = NOW() WHERE username = ?', [username]);
      } else {
        await db.execute('INSERT INTO users (username, date_added, date_updated) VALUES (?, NOW(), NOW())', [username]);
      }

      // 2. Handle Stats Table
      let statId = null;
      if (distanceWalked !== undefined && caught !== undefined && totalXp !== undefined) {
        const [statResult] = await db.execute(
          'INSERT INTO stats (username, level, distance_walked, caught, stop_visited, total_xp, entry_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [username, level || null, distanceWalked || 0, caught || 0, stopVisited || null, totalXp || 0, entryName || null]
        );
        statId = statResult.insertId;
      }

      res.json({ success: true, statId, previousStats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Updates the latest entry for a user if they had to correcta parsed entry
  app.put('/update-data/:id', async (req, res) => {
    try {
      const statId = req.params.id;
      const { username, level, distanceWalked, caught, stopVisited, totalXp, entryName } = req.body;
      
      await db.execute(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, entry_name = ? WHERE id = ?',
        [username, level || null, distanceWalked || 0, caught || 0, stopVisited || null, totalXp || 0, entryName || null, statId]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Deletes an entry
  app.delete('/delete-data/:id', async (req, res) => {
    try {
      const statId = req.params.id;
      await db.execute('DELETE FROM stats WHERE id = ?', [statId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Fetches all stats from the database
  app.get('/get-data', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM stats ORDER BY created_at DESC');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Fetches all stats for a specific user, sorted chronologically for charting
  app.get('/get-user-stats/:username', async (req, res) => {
    try {
      const username = req.params.username;
      const [rows] = await db.execute('SELECT * FROM stats WHERE username = ? ORDER BY created_at ASC', [username]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Fetches all users from the database
  app.get('/get-users', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM users');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Cleanup endpoint for Cypress tests
  app.delete('/cleanup-test-data', async (req, res) => {
    try {
      const testUsernames = [
        'Stillworld', 'crosspawz', 'Swagpapa209', 
        'DarkraiPH1111', 'TheSleepySiren1', 'TheSleepySirenl', 
        'RedEliGmz', 'RedEliGm', 'Zaford42'
      ];
      
      const placeholders = testUsernames.map(() => '?').join(',');
      await db.execute(`DELETE FROM stats WHERE username IN (${placeholders})`, testUsernames);
      await db.execute(`DELETE FROM users WHERE username IN (${placeholders})`, testUsernames);
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });
};