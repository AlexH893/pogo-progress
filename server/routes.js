const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { requireAuth, optionalAuth, JWT_SECRET } = require('./middleware/auth');
const { validateStats, validatePreferences } = require('./middleware/validation');
const { authLimiter, actionLimiter } = require('./middleware/rateLimiter');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let client;
if (CLIENT_ID) {
  client = new OAuth2Client(CLIENT_ID);
}

module.exports = function (app, db) {

  // Google Auth Endpoint
  app.post('/auth/google', authLimiter, async (req, res) => {
    try {
      if (!client) {
        return res.status(500).json({ error: 'Server not configured for Google Auth' });
      }
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: 'Missing credential' });
      
      const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      // Issue our own JWT
      const token = jwt.sign({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name
      }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ token, user: { googleId: payload.sub, email: payload.email, name: payload.name } });
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Cypress Auth Mock Endpoint
  app.get('/auth/test-token', authLimiter, (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not allowed in production' });
    }
    const token = jwt.sign(
      { googleId: 'cypress_test_user_id', email: 'cypress@test.com', name: 'Cypress Test' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token, user: { googleId: 'cypress_test_user_id', email: 'cypress@test.com', name: 'Cypress Test' } });
  });

  // Posts user's stats to database. Used when the user first uploads a screenshot.
  app.post('/post-data', optionalAuth, actionLimiter, validateStats, async (req, res) => {
    try {
      const { username, level, distanceWalked, caught, stopVisited, totalXp, entryName, createdAt } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Username required' });
      }

      const insertDate = createdAt ? new Date(createdAt) : new Date();

      // Fetch the previous stats before inserting
      const [prevRows] = await db.execute('SELECT * FROM stats WHERE username = ? AND created_at <= ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1', [username, insertDate]);
      const previousStats = prevRows.length > 0 ? prevRows[0] : null;
      
      // 1. Handle Users Table
      const [rows] = await db.execute('SELECT id, google_id FROM users WHERE username = ? AND is_deleted = 0', [username]);
      
      if (req.user) {
        const [existingUsers] = await db.execute('SELECT username FROM users WHERE google_id = ? AND is_deleted = 0', [req.user.googleId]);
        if (existingUsers.length > 0 && existingUsers[0].username !== username) {
          return res.status(403).json({ error: 'You can only link one trainer to your account.' });
        }
      }

      if (rows.length > 0) {
        const userRow = rows[0];
        if (userRow.google_id) {
          if (!req.user || userRow.google_id !== req.user.googleId) {
            return res.status(403).json({ error: 'This trainer is linked to an account. Please log in to upload stats.' });
          }
        }
        if (!userRow.google_id && req.user) {
          await db.execute('UPDATE users SET date_updated = NOW(), google_id = ? WHERE username = ?', 
            [req.user.googleId, username]);
        } else {
          await db.execute('UPDATE users SET date_updated = NOW() WHERE username = ?', [username]);
        }
      } else {
        if (req.user) {
          await db.execute('INSERT INTO users (username, date_added, date_updated, google_id) VALUES (?, NOW(), NOW(), ?)', 
            [username, req.user.googleId]);
        } else {
          await db.execute('INSERT INTO users (username, date_added, date_updated) VALUES (?, NOW(), NOW())', [username]);
        }
      }

      // 2. Handle Stats Table
      let statId = null;
      if (distanceWalked !== undefined && caught !== undefined && totalXp !== undefined) {
        // Check if it's the first upload ever
        const [allStats] = await db.execute('SELECT id FROM stats WHERE username = ? AND is_deleted = 0 LIMIT 1', [username]);
        const isFirstEverUpload = allStats.length === 0;

        const [statResult] = await db.execute(
          'INSERT INTO stats (username, level, distance_walked, caught, stop_visited, total_xp, entry_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [username, level || null, distanceWalked || 0, caught || 0, stopVisited || null, totalXp || 0, entryName || null, insertDate]
        );
        statId = statResult.insertId;

        // Turn off tutorial if this was their first successful upload
        if (isFirstEverUpload) {
          await db.execute('UPDATE users SET display_tutorial = false WHERE username = ?', [username]);
        }
      }

      res.json({ success: true, statId, previousStats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Updates the latest entry for a user if they had to correcta parsed entry
  app.put('/update-data/:id', requireAuth, actionLimiter, validateStats, async (req, res) => {
    try {
      const statId = req.params.id;
      const { username, level, distanceWalked, caught, stopVisited, totalXp, entryName, createdAt } = req.body;
      
      // 1. Verify ownership of the existing stat
      const [statRows] = await db.execute('SELECT username FROM stats WHERE id = ? AND is_deleted = 0', [statId]);
      if (statRows.length === 0) return res.status(404).json({ error: 'Not found' });
      const originalUsername = statRows[0].username;
      
      const [originalUserRows] = await db.execute('SELECT google_id FROM users WHERE username = ? AND is_deleted = 0', [originalUsername]);
      if (originalUserRows.length === 0 || originalUserRows[0].google_id !== req.user.googleId) {
        return res.status(403).json({ error: 'Not authorized to edit this entry.' });
      }

      // 2. If the username is being changed, verify ownership of the new username too
      if (username !== originalUsername) {
        const [newUserRows] = await db.execute('SELECT google_id FROM users WHERE username = ? AND is_deleted = 0', [username]);
        if (newUserRows.length === 0 || newUserRows[0].google_id !== req.user.googleId) {
          return res.status(403).json({ error: 'Not authorized to assign to this trainer.' });
        }
      }

      if (createdAt) {
        await db.execute(
          'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, entry_name = ?, created_at = ? WHERE id = ?',
          [username, level || null, distanceWalked || 0, caught || 0, stopVisited || null, totalXp || 0, entryName || null, new Date(createdAt), statId]
        );
      } else {
        await db.execute(
          'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, entry_name = ? WHERE id = ?',
          [username, level || null, distanceWalked || 0, caught || 0, stopVisited || null, totalXp || 0, entryName || null, statId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Deletes an entry
  app.delete('/delete-data/:id', requireAuth, actionLimiter, async (req, res) => {
    try {
      const statId = req.params.id;
      
      const [statRows] = await db.execute('SELECT username FROM stats WHERE id = ? AND is_deleted = 0', [statId]);
      if (statRows.length === 0) return res.status(404).json({ error: 'Not found' });
      const statUsername = statRows[0].username;
      
      const [userRows] = await db.execute('SELECT google_id FROM users WHERE username = ? AND is_deleted = 0', [statUsername]);
      if (userRows.length === 0 || userRows[0].google_id !== req.user.googleId) {
        return res.status(403).json({ error: 'Not authorized to delete this entry.' });
      }

      await db.execute('UPDATE stats SET is_deleted = 1 WHERE id = ?', [statId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Fetches stats from the database for the authenticated user
  app.get('/get-data', optionalAuth, async (req, res) => {
    try {
      require('fs').appendFileSync('cypress-debug.log', `[get-data] req.user: ${JSON.stringify(req.user)}\n`);
      if (!req.user) {
        console.log('[get-data] No user found in req');
        return res.json([]);
      }
      const [rows] = await db.execute('SELECT stats.*, users.google_id, users.default_unit FROM stats LEFT JOIN users ON stats.username = users.username WHERE users.google_id = ? AND stats.is_deleted = 0 AND users.is_deleted = 0 ORDER BY stats.created_at DESC', [req.user.googleId]);
      require('fs').appendFileSync('cypress-debug.log', `[get-data] Fetched ${rows.length} rows for google_id: ${req.user.googleId}\n`);
      console.log(`[get-data] Fetched ${rows.length} rows for google_id: ${req.user.googleId}`);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Fetches all stats for a specific user, sorted chronologically for charting
  app.get('/get-user-stats/:username', optionalAuth, async (req, res) => {
    try {
      const username = req.params.username;
      
      const [userRows] = await db.execute('SELECT google_id FROM users WHERE username = ? AND is_deleted = 0', [username]);
      if (userRows.length > 0) {
        const userRow = userRows[0];
        if (userRow.google_id) {
          if (!req.user || userRow.google_id !== req.user.googleId) {
            return res.status(403).json({ error: 'Private profile' });
          }
        }
      }

      const [rows] = await db.execute('SELECT id, username, level, distance_walked, caught, stop_visited, total_xp, entry_name, created_at FROM stats WHERE username = ? AND is_deleted = 0 ORDER BY created_at ASC', [username]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });



  // Settings and Preferences
  
  // Get linked trainers and preferences for the current logged-in Google account
  app.get('/user-preferences', requireAuth, async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT username, default_unit, show_fun_facts, display_tutorial FROM users WHERE google_id = ? AND is_deleted = 0', [req.user.googleId]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Update preferences for a specific trainer profile linked to the current Google account
  app.put('/user-preferences/:username', requireAuth, actionLimiter, validatePreferences, async (req, res) => {
    try {
      const username = req.params.username;
      const { defaultUnit, showFunFacts, displayTutorial } = req.body;
      
      const [userRows] = await db.execute('SELECT google_id FROM users WHERE username = ? AND is_deleted = 0', [username]);
      if (userRows.length === 0 || userRows[0].google_id !== req.user.googleId) {
        return res.status(403).json({ error: 'Not authorized to edit this trainer.' });
      }

      await db.execute(
        'UPDATE users SET default_unit = ?, show_fun_facts = ?, display_tutorial = ? WHERE username = ?',
        [defaultUnit || 'km', showFunFacts !== false, displayTutorial !== false, username]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Export all data for trainers linked to the current Google account
  app.get('/export-data', requireAuth, async (req, res) => {
    try {
      const [userRows] = await db.execute('SELECT username FROM users WHERE google_id = ? AND is_deleted = 0', [req.user.googleId]);
      if (userRows.length === 0) {
        return res.json([]);
      }
      const usernames = userRows.map(r => r.username);
      const placeholders = usernames.map(() => '?').join(',');
      
      const [statRows] = await db.execute(`SELECT * FROM stats WHERE username IN (${placeholders}) AND is_deleted = 0 ORDER BY username ASC, created_at ASC`, usernames);
      res.json(statRows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Unlink a trainer from the current Google account
  app.delete('/unlink-trainer/:username', requireAuth, async (req, res) => {
    try {
      const username = req.params.username;
      
      const [userRows] = await db.execute('SELECT google_id FROM users WHERE username = ? AND is_deleted = 0', [username]);
      if (userRows.length === 0 || userRows[0].google_id !== req.user.googleId) {
        return res.status(403).json({ error: 'Not authorized to unlink this trainer.' });
      }

      await db.execute('UPDATE users SET google_id = NULL WHERE username = ?', [username]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Delete all data associated with the current Google account
  app.delete('/delete-account', requireAuth, async (req, res) => {
    try {
      const [userRows] = await db.execute('SELECT username FROM users WHERE google_id = ? AND is_deleted = 0', [req.user.googleId]);
      
      if (userRows.length > 0) {
        const usernames = userRows.map(r => r.username);
        const placeholders = usernames.map(() => '?').join(',');
        
        // Delete stats first due to foreign key constraints if any (even if implicit)
        await db.execute(`UPDATE stats SET is_deleted = 1 WHERE username IN (${placeholders})`, usernames);
        await db.execute(`UPDATE users SET is_deleted = 1 WHERE google_id = ?`, [req.user.googleId]);
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Cleanup endpoint for Cypress tests
  app.delete('/cleanup-test-data', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not allowed in production' });
    }
    try {
      // First find all usernames linked to the test user
      const [userRows] = await db.execute('SELECT username FROM users WHERE google_id = ?', ['cypress_test_user_id']);
      
      const testUsernames = [
        'Stillworld', 'crosspawz', 'Swagpapa209', 
        'DarkraiPH1111', 'TheSleepySiren1', 'TheSleepySirenl', 
        'RedEliGmz', 'RedEliGm', 'Zaford42', 'CypressTestUser'
      ];
      
      // Combine hardcoded ones with any dynamically linked ones (to clean up OCR typos)
      const allUsernamesToDelete = [...new Set([...testUsernames, ...userRows.map(r => r.username)])];
      
      if (allUsernamesToDelete.length > 0) {
        const placeholders = allUsernamesToDelete.map(() => '?').join(',');
        await db.execute(`DELETE FROM stats WHERE username IN (${placeholders})`, allUsernamesToDelete);
        await db.execute(`DELETE FROM users WHERE username IN (${placeholders})`, allUsernamesToDelete);
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });
};